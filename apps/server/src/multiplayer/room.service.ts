import { randomBytes } from 'node:crypto'

import {
    RECONNECT_GRACE_MS,
    type Competitor,
    type CreateRoomCommand,
    type JoinRoomCommand,
    type MatchSession,
    type ModeId,
    type ProtocolErrorCode,
    type ReadyRoomCommand,
    type ResumeRoomCommand,
    type RoomAccess,
    type RoomState,
    type ShotCommand,
    type WireMatchSnapshot,
    createMatchSession,
    modes,
} from '@guess-my-move/marbles'

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const DEFAULT_MAX_ROOMS = 100
const DEFAULT_SHOT_PREVIEW_MS = 450
const DEFAULT_ROUND_DWELL_MS = 900

export class RoomError extends Error {
    constructor(
        readonly code: ProtocolErrorCode,
        message: string,
    ) {
        super(message)
        this.name = 'RoomError'
    }
}

interface Slot {
    socketId: string | null
    readonly token: string
    ready: boolean
    lastSeq: number
    disconnectedAt: number | null
}

interface PendingShot {
    readonly competitor: Competitor
    readonly velocity: { x: number; y: number }
    remainingMs: number
}

interface Room {
    readonly code: string
    readonly modeId: ModeId
    readonly slots: Record<Competitor, Slot>
    status: RoomState['status']
    version: number
    session: MatchSession | null
    pendingShot: PendingShot | null
    roundDwellMs: number | null
}

interface SocketMembership {
    readonly roomCode: string
    readonly role: Competitor
}

export interface RoomServiceOptions {
    now?: () => number
    code?: () => string
    token?: () => string
    maxRooms?: number
    shotPreviewMs?: number
    roundDwellMs?: number
}

export interface RoomMutation {
    access: RoomAccess
    state: RoomState
}

export interface TickResult {
    updated: RoomState[]
    expired: string[]
}

function randomCode(): string {
    const bytes = randomBytes(6)
    return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('')
}

function randomToken(): string {
    return randomBytes(24).toString('base64url')
}

/**
 * Salas efêmeras e autoritativas. Não conhece Socket.IO: associa ids opacos de
 * conexão a papéis e devolve estados serializáveis para o gateway publicar.
 */
export class RoomService {
    private readonly rooms = new Map<string, Room>()
    private readonly sockets = new Map<string, SocketMembership>()
    private readonly now: () => number
    private readonly code: () => string
    private readonly token: () => string
    private readonly maxRooms: number
    private readonly shotPreviewMs: number
    private readonly roundDwellMs: number

    constructor(options: RoomServiceOptions = {}) {
        this.now = options.now ?? Date.now
        this.code = options.code ?? randomCode
        this.token = options.token ?? randomToken
        this.maxRooms = options.maxRooms ?? DEFAULT_MAX_ROOMS
        this.shotPreviewMs = options.shotPreviewMs ?? DEFAULT_SHOT_PREVIEW_MS
        this.roundDwellMs = options.roundDwellMs ?? DEFAULT_ROUND_DWELL_MS
    }

    create(socketId: string, command: CreateRoomCommand): RoomMutation {
        this.assertSocketFree(socketId)
        if (this.rooms.size >= this.maxRooms) {
            throw new RoomError('ROOM_LIMIT', 'O limite de salas ativas foi atingido.')
        }
        const code = this.uniqueCode()
        const player: Slot = {
            socketId,
            token: this.token(),
            ready: false,
            lastSeq: 0,
            disconnectedAt: null,
        }
        const room: Room = {
            code,
            modeId: command.modeId,
            slots: {
                player,
                opponent: {
                    socketId: null,
                    token: this.token(),
                    ready: false,
                    lastSeq: 0,
                    disconnectedAt: null,
                },
            },
            status: 'waiting',
            version: 0,
            session: null,
            pendingShot: null,
            roundDwellMs: null,
        }
        this.rooms.set(code, room)
        this.sockets.set(socketId, { roomCode: code, role: 'player' })
        return { access: this.access(room, 'player'), state: this.toState(room) }
    }

    join(socketId: string, command: JoinRoomCommand): RoomMutation {
        this.assertSocketFree(socketId)
        const room = this.getRoom(command.roomCode)
        if (room.session || room.status === 'playing' || room.status === 'paused') {
            throw new RoomError('ROOM_STARTED', 'A partida desta sala já começou.')
        }
        const slot = room.slots.opponent
        if (slot.socketId || slot.disconnectedAt !== null) {
            throw new RoomError('ROOM_FULL', 'A sala já tem duas pessoas.')
        }
        slot.socketId = socketId
        room.status = 'ready'
        room.version++
        this.sockets.set(socketId, { roomCode: room.code, role: 'opponent' })
        return { access: this.access(room, 'opponent'), state: this.toState(room) }
    }

    resume(socketId: string, command: ResumeRoomCommand): RoomMutation {
        this.assertSocketFree(socketId)
        const room = this.getRoom(command.roomCode)
        const role = this.roleForToken(room, command.resumeToken)
        if (!role) throw new RoomError('RESUME_DENIED', 'Não foi possível retomar esta vaga.')
        const slot = room.slots[role]
        if (slot.socketId || slot.disconnectedAt === null) {
            throw new RoomError('RESUME_DENIED', 'Esta vaga já está conectada.')
        }
        if (this.now() > slot.disconnectedAt + RECONNECT_GRACE_MS) {
            throw new RoomError('RESUME_DENIED', 'O tempo para retomar a sala terminou.')
        }
        slot.socketId = socketId
        slot.disconnectedAt = null
        this.sockets.set(socketId, { roomCode: room.code, role })
        room.status = this.connectedStatus(room)
        room.version++
        return { access: this.access(room, role), state: this.toState(room) }
    }

    setReady(socketId: string, command: ReadyRoomCommand): RoomState {
        const { room, role } = this.membership(socketId)
        if (room.session) return this.toState(room)
        if (room.status === 'paused') throw new RoomError('NOT_READY', 'Aguarde a reconexão antes de ficar pronto.')
        const slot = room.slots[role]
        if (slot.ready === command.ready) return this.toState(room)
        slot.ready = command.ready
        if (
            room.slots.player.socketId &&
            room.slots.opponent.socketId &&
            room.slots.player.ready &&
            room.slots.opponent.ready
        ) {
            const entry = modes.find(({ id }) => id === room.modeId)
            if (!entry) throw new RoomError('INVALID_PAYLOAD', 'Modo de jogo inválido.')
            room.session = createMatchSession({
                modeId: room.modeId,
                mode: entry.create(),
                opponent: 'remote',
            })
            room.status = 'playing'
        } else {
            room.status = room.slots.player.socketId && room.slots.opponent.socketId ? 'ready' : 'waiting'
        }
        room.version++
        return this.toState(room)
    }

    submitShot(socketId: string, command: ShotCommand): RoomState {
        const { room, role } = this.membership(socketId)
        const slot = room.slots[role]
        if (command.seq <= slot.lastSeq) {
            throw new RoomError('DUPLICATE_COMMAND', 'Este comando de tiro já foi recebido.')
        }
        if (room.status !== 'playing' || !room.session || room.pendingShot) {
            throw new RoomError('NOT_READY', 'A partida não está pronta para outro tiro.')
        }
        const snapshot = room.session.snapshot()
        const expectedPhase = role === 'player' ? 'player-turn' : 'opponent-turn'
        if (snapshot.phase !== expectedPhase) {
            if (snapshot.turn === role) {
                throw new RoomError('NOT_READY', 'Aguarde a bolinha parar para atirar de novo.')
            }
            throw new RoomError('NOT_YOUR_TURN', 'Aguarde a sua vez para atirar.')
        }
        if (snapshot.turn !== role) {
            throw new RoomError('NOT_YOUR_TURN', 'Aguarde a sua vez para atirar.')
        }
        slot.lastSeq = command.seq
        room.pendingShot = {
            competitor: role,
            velocity: { ...command.velocity },
            remainingMs: this.shotPreviewMs,
        }
        room.version++
        return this.toState(room)
    }

    disconnect(socketId: string): RoomState | null {
        const membership = this.sockets.get(socketId)
        if (!membership) return null
        this.sockets.delete(socketId)
        const room = this.rooms.get(membership.roomCode)
        if (!room) return null
        const slot = room.slots[membership.role]
        if (slot.socketId !== socketId) return null
        slot.socketId = null
        slot.disconnectedAt = this.now()
        room.status = 'paused'
        room.version++
        return this.toState(room)
    }

    leave(socketId: string): string | null {
        const membership = this.sockets.get(socketId)
        if (!membership) return null
        this.removeRoom(membership.roomCode)
        return membership.roomCode
    }

    state(roomCode: string): RoomState | undefined {
        const room = this.rooms.get(roomCode)
        return room ? this.toState(room) : undefined
    }

    stateForSocket(socketId: string): RoomState | undefined {
        const membership = this.sockets.get(socketId)
        return membership ? this.state(membership.roomCode) : undefined
    }

    membershipForSocket(socketId: string): SocketMembership | undefined {
        return this.sockets.get(socketId)
    }

    tick(dtMs: number): TickResult {
        const updated: RoomState[] = []
        const expired: string[] = []
        const elapsedMs = Math.max(0, dtMs)
        const safeDt = Math.min(elapsedMs, 250)

        for (const room of [...this.rooms.values()]) {
            if (this.hasExpiredSlot(room)) {
                expired.push(room.code)
                this.removeRoom(room.code)
                continue
            }
            if (room.status !== 'playing' || !room.session) continue

            let changed = false
            if (room.pendingShot) {
                room.pendingShot.remainingMs -= elapsedMs
                if (room.pendingShot.remainingMs <= 0) {
                    const { competitor, velocity } = room.pendingShot
                    room.pendingShot = null
                    room.session.fireShot(competitor, velocity)
                    changed = true
                }
            } else {
                const before = room.session.snapshot()
                if (before.phase === 'rolling') {
                    room.session.advance(safeDt)
                    changed = true
                }
                const after = room.session.snapshot()
                if (after.phase === 'round-over') {
                    room.roundDwellMs ??= this.roundDwellMs
                    room.roundDwellMs -= elapsedMs
                    if (room.roundDwellMs <= 0) {
                        room.roundDwellMs = null
                        room.session.beginNextRound()
                        changed = true
                    }
                } else {
                    room.roundDwellMs = null
                }
                if (room.session.snapshot().phase === 'match-over') room.status = 'finished'
            }

            if (changed) {
                room.version++
                updated.push(this.toState(room))
            }
        }
        return { updated, expired }
    }

    private access(room: Room, role: Competitor): RoomAccess {
        return { roomCode: room.code, role, resumeToken: room.slots[role].token }
    }

    private toState(room: Room): RoomState {
        return {
            roomCode: room.code,
            modeId: room.modeId,
            status: room.status,
            version: room.version,
            players: {
                player: {
                    connected: room.slots.player.socketId !== null,
                    ready: room.slots.player.ready,
                },
                opponent: {
                    connected: room.slots.opponent.socketId !== null,
                    ready: room.slots.opponent.ready,
                },
            },
            match: room.session ? this.toWireSnapshot(room.modeId, room.session) : null,
            intent: room.pendingShot
                ? {
                      competitor: room.pendingShot.competitor,
                      velocity: { ...room.pendingShot.velocity },
                  }
                : null,
            reconnectDeadlineMs: this.reconnectDeadline(room),
        }
    }

    private toWireSnapshot(modeId: ModeId, session: MatchSession): WireMatchSnapshot {
        // Cada modo prepara a bolinha da pessoa da vez antes de o cliente calcular a mira.
        session.shooter()
        const snapshot = session.snapshot()
        return {
            modeId,
            opponent: 'remote',
            phase: snapshot.phase,
            round: snapshot.round,
            roundsPerMatch: snapshot.roundsPerMatch,
            roundOutcomes: [...snapshot.roundOutcomes],
            lastRoundOutcome: snapshot.lastRoundOutcome,
            matchOutcome: snapshot.matchOutcome,
            turn: snapshot.turn,
            shotsLeft: { ...snapshot.shotsLeft },
            roundYield: { ...snapshot.roundYield },
            scoreLabel: snapshot.scoreLabel,
            field: snapshot.field.map((body) => ({
                pos: { ...body.pos },
                vel: { ...body.vel },
                radius: body.radius,
            })),
            decor: snapshot.decor
                ? {
                      ...(snapshot.decor.circle
                          ? { circle: { ...snapshot.decor.circle } }
                          : {}),
                      ...(snapshot.decor.holes
                          ? {
                                holes: {
                                    positions: snapshot.decor.holes.positions.map((point) => ({
                                        ...point,
                                    })),
                                    radius: snapshot.decor.holes.radius,
                                    active: snapshot.decor.holes.active,
                                },
                            }
                          : {}),
                      ...(snapshot.decor.resting
                          ? {
                                resting: snapshot.decor.resting.map((rest) => ({
                                    pos: { ...rest.pos },
                                    radius: rest.radius,
                                    owner: rest.owner,
                                })),
                            }
                          : {}),
                  }
                : null,
        }
    }

    private connectedStatus(room: Room): RoomState['status'] {
        if (Object.values(room.slots).some(slot => slot.disconnectedAt !== null)) return 'paused'
        if (!room.session) return room.slots.opponent.socketId ? 'ready' : 'waiting'
        if (room.session.snapshot().phase === 'match-over') return 'finished'
        return 'playing'
    }

    private reconnectDeadline(room: Room): number | null {
        const deadlines = Object.values(room.slots)
            .map((slot) =>
                slot.disconnectedAt === null ? null : slot.disconnectedAt + RECONNECT_GRACE_MS,
            )
            .filter((value): value is number => value !== null)
        return deadlines.length > 0 ? Math.min(...deadlines) : null
    }

    private hasExpiredSlot(room: Room): boolean {
        const now = this.now()
        return Object.values(room.slots).some(
            (slot) =>
                slot.disconnectedAt !== null && now > slot.disconnectedAt + RECONNECT_GRACE_MS,
        )
    }

    private roleForToken(room: Room, token: string): Competitor | null {
        if (room.slots.player.token === token) return 'player'
        if (room.slots.opponent.token === token) return 'opponent'
        return null
    }

    private membership(socketId: string): { room: Room; role: Competitor } {
        const membership = this.sockets.get(socketId)
        if (!membership) throw new RoomError('NOT_IN_ROOM', 'Entre numa sala primeiro.')
        const room = this.rooms.get(membership.roomCode)
        if (!room) throw new RoomError('ROOM_NOT_FOUND', 'Sala não encontrada.')
        return { room, role: membership.role }
    }

    private getRoom(code: string): Room {
        const room = this.rooms.get(code)
        if (!room) throw new RoomError('ROOM_NOT_FOUND', 'Sala não encontrada.')
        return room
    }

    private assertSocketFree(socketId: string): void {
        if (this.sockets.has(socketId)) {
            throw new RoomError('NOT_READY', 'Esta conexão já está em uma sala.')
        }
    }

    private uniqueCode(): string {
        for (let attempt = 0; attempt < 32; attempt++) {
            const candidate = this.code()
            if (!this.rooms.has(candidate)) return candidate
        }
        throw new RoomError('ROOM_LIMIT', 'Não foi possível reservar um código de sala.')
    }

    private removeRoom(code: string): void {
        const room = this.rooms.get(code)
        if (!room) return
        for (const slot of Object.values(room.slots)) {
            if (slot.socketId) this.sockets.delete(slot.socketId)
        }
        this.rooms.delete(code)
    }
}
