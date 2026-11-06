import { projectMatch, projectPlayers } from './public-room.js'
import { randomBytes } from 'node:crypto'

import {
    RECONNECT_GRACE_MS,
    nicknameSchema,
    type RematchRoomCommand,
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
    nickname: string | null
    rematchReady: boolean
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
    lastActivityAt: number
    readonly modeId: ModeId
    readonly slots: Record<Competitor, Slot>
    status: RoomState['status']
    version: number
    matchNumber: number
    session: MatchSession | null
    pendingShot: PendingShot | null
    roundDwellMs: number | null
}

interface SocketMembership {
    readonly roomCode: string
    readonly role: Competitor
}

export interface RoomServiceOptions {
    canCreateRoom?: () => boolean
    now?: () => number
    code?: () => string
    token?: () => string
    maxRooms?: number
    shotPreviewMs?: number
    roundDwellMs?: number
    waitingTimeoutMs?: number
    idleTimeoutMs?: number
    finishedTimeoutMs?: number
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
    return Array.from(
        bytes,
        (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length],
    ).join('')
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
    private readonly timeouts: {
        waiting: number
        idle: number
        finished: number
    }

    constructor(private readonly options: RoomServiceOptions = {}) {
        this.now = options.now ?? Date.now
        this.code = options.code ?? randomCode
        this.token = options.token ?? randomToken
        this.maxRooms = options.maxRooms ?? DEFAULT_MAX_ROOMS
        this.shotPreviewMs = options.shotPreviewMs ?? DEFAULT_SHOT_PREVIEW_MS
        this.roundDwellMs = options.roundDwellMs ?? DEFAULT_ROUND_DWELL_MS
        this.timeouts = {
            waiting: options.waitingTimeoutMs ?? 300_000,
            idle: options.idleTimeoutMs ?? 900_000,
            finished: options.finishedTimeoutMs ?? 300_000,
        }
    }

    create(socketId: string, command: CreateRoomCommand): RoomMutation {
        this.assertSocketFree(socketId)
        if (
            this.rooms.size >= this.maxRooms ||
            this.options.canCreateRoom?.() === false
        ) {
            throw new RoomError(
                'ROOM_LIMIT',
                'O limite de salas ativas foi atingido.',
            )
        }
        const code = this.uniqueCode()
        const player: Slot = {
            socketId,
            token: this.token(),
            ready: false,
            nickname: this.nickname(command.nickname, 'Jogador 1'),
            rematchReady: false,
            lastSeq: 0,
            disconnectedAt: null,
        }
        const room: Room = {
            code,
            lastActivityAt: this.now(),
            modeId: command.modeId,
            slots: {
                player,
                opponent: {
                    socketId: null,
                    token: this.token(),
                    ready: false,
                    nickname: null,
                    rematchReady: false,
                    lastSeq: 0,
                    disconnectedAt: null,
                },
            },
            status: 'waiting',
            version: 0,
            matchNumber: 1,
            session: null,
            pendingShot: null,
            roundDwellMs: null,
        }
        this.rooms.set(code, room)
        this.sockets.set(socketId, { roomCode: code, role: 'player' })
        return {
            access: this.access(room, 'player'),
            state: this.toState(room),
        }
    }

    join(socketId: string, command: JoinRoomCommand): RoomMutation {
        this.assertSocketFree(socketId)
        const room = this.getRoom(command.roomCode)
        if (
            room.session ||
            room.status === 'playing' ||
            room.status === 'paused'
        ) {
            throw new RoomError(
                'ROOM_STARTED',
                'A partida desta sala já começou.',
            )
        }
        const slot = room.slots.opponent
        if (slot.socketId || slot.disconnectedAt !== null) {
            throw new RoomError('ROOM_FULL', 'A sala já tem duas pessoas.')
        }
        const nickname = this.nickname(command.nickname, 'Jogador 2')
        if (
            nickname.toLocaleLowerCase('pt-BR') ===
            room.slots.player.nickname?.toLocaleLowerCase('pt-BR')
        ) {
            throw new RoomError(
                'NICKNAME_TAKEN',
                'Esse apelido já está na sala. Escolha outro.',
            )
        }
        room.lastActivityAt = this.now()
        slot.nickname = nickname
        slot.socketId = socketId
        room.status = 'ready'
        room.version++
        this.sockets.set(socketId, { roomCode: room.code, role: 'opponent' })
        return {
            access: this.access(room, 'opponent'),
            state: this.toState(room),
        }
    }

    resume(socketId: string, command: ResumeRoomCommand): RoomMutation {
        this.assertSocketFree(socketId)
        const room = this.getRoom(command.roomCode)
        const role = this.roleForToken(room, command.resumeToken)
        if (!role)
            throw new RoomError(
                'RESUME_DENIED',
                'Não foi possível retomar esta vaga.',
            )
        const slot = room.slots[role]
        if (slot.socketId || slot.disconnectedAt === null) {
            throw new RoomError('RESUME_DENIED', 'Esta vaga já está conectada.')
        }
        if (this.now() > slot.disconnectedAt + RECONNECT_GRACE_MS) {
            throw new RoomError(
                'RESUME_DENIED',
                'O tempo para retomar a sala terminou.',
            )
        }
        slot.socketId = socketId
        slot.disconnectedAt = null
        room.lastActivityAt = this.now()
        this.sockets.set(socketId, { roomCode: room.code, role })
        room.status = this.connectedStatus(room)
        room.version++
        return { access: this.access(room, role), state: this.toState(room) }
    }

    setReady(socketId: string, command: ReadyRoomCommand): RoomState {
        const { room, role } = this.membership(socketId)
        if (room.session) return this.toState(room)
        if (room.status === 'paused')
            throw new RoomError(
                'NOT_READY',
                'Aguarde a reconexão antes de ficar pronto.',
            )
        const slot = room.slots[role]
        if (slot.ready === command.ready) return this.toState(room)
        room.lastActivityAt = this.now()
        slot.ready = command.ready
        if (
            room.slots.player.socketId &&
            room.slots.opponent.socketId &&
            room.slots.player.ready &&
            room.slots.opponent.ready
        ) {
            this.startMatch(room)
        } else {
            room.status =
                room.slots.player.socketId && room.slots.opponent.socketId
                    ? 'ready'
                    : 'waiting'
        }
        room.version++
        return this.toState(room)
    }

    setRematchReady(socketId: string, command: RematchRoomCommand): RoomState {
        const { room, role } = this.membership(socketId)
        if (command.matchNumber !== room.matchNumber)
            throw new RoomError(
                'STALE_MATCH',
                'Este comando é de outra partida.',
            )
        if (
            room.status !== 'finished' ||
            room.session?.snapshot().phase !== 'match-over'
        ) {
            throw new RoomError(
                'NOT_READY',
                'Aguarde o fim da partida e as duas conexões para jogar novamente.',
            )
        }
        if (room.slots[role].rematchReady === command.ready)
            return this.toState(room)
        room.lastActivityAt = this.now()
        room.slots[role].rematchReady = command.ready
        if (
            Object.values(room.slots).every(
                (slot) => slot.socketId && slot.rematchReady,
            )
        ) {
            room.matchNumber++
            this.startMatch(room)
        }
        room.version++
        return this.toState(room)
    }

    private startMatch(room: Room): void {
        const entry = modes.find(({ id }) => id === room.modeId)
        if (!entry)
            throw new RoomError('INVALID_PAYLOAD', 'Modo de jogo inválido.')
        room.session = createMatchSession({
            modeId: room.modeId,
            mode: entry.create(),
            opponent: 'remote',
        })
        room.session.shooter()
        room.pendingShot = null
        room.roundDwellMs = null
        for (const slot of Object.values(room.slots)) slot.rematchReady = false
        room.status = 'playing'
    }

    private nickname(value: string | undefined, fallback: string): string {
        const parsed = nicknameSchema.safeParse(value ?? fallback)
        if (!parsed.success)
            throw new RoomError(
                'INVALID_PAYLOAD',
                'Use um apelido de 2 a 20 caracteres: letras, números, espaço, ponto, hífen ou sublinhado.',
            )
        return parsed.data
    }

    submitShot(socketId: string, command: ShotCommand): RoomState {
        const { room, role } = this.membership(socketId)
        const slot = room.slots[role]
        if ((command.matchNumber ?? 1) !== room.matchNumber)
            throw new RoomError('STALE_MATCH', 'Este tiro é de outra partida.')
        if (command.seq <= slot.lastSeq) {
            throw new RoomError(
                'DUPLICATE_COMMAND',
                'Este comando de tiro já foi recebido.',
            )
        }
        if (room.status !== 'playing' || !room.session || room.pendingShot) {
            throw new RoomError(
                'NOT_READY',
                'A partida não está pronta para outro tiro.',
            )
        }
        const snapshot = room.session.snapshot()
        const expectedPhase =
            role === 'player' ? 'player-turn' : 'opponent-turn'
        if (snapshot.phase !== expectedPhase) {
            if (snapshot.turn === role) {
                throw new RoomError(
                    'NOT_READY',
                    'Aguarde a bolinha parar para atirar de novo.',
                )
            }
            throw new RoomError(
                'NOT_YOUR_TURN',
                'Aguarde a sua vez para atirar.',
            )
        }
        if (snapshot.turn !== role) {
            throw new RoomError(
                'NOT_YOUR_TURN',
                'Aguarde a sua vez para atirar.',
            )
        }
        room.lastActivityAt = this.now()
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
            if (this.hasExpiredSlot(room) || this.isInactive(room)) {
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
                if (room.session.snapshot().phase === 'match-over')
                    room.status = 'finished'
            }

            if (changed) {
                // Preparing the next turn is a mutation, never a serialization side effect.
                room.session.shooter()
                room.lastActivityAt = this.now()
                room.version++
                updated.push(this.toState(room))
            }
        }
        return { updated, expired }
    }

    private access(room: Room, role: Competitor): RoomAccess {
        return {
            roomCode: room.code,
            role,
            resumeToken: room.slots[role].token,
        }
    }

    private toState(room: Room): RoomState {
        return {
            roomCode: room.code,
            modeId: room.modeId,
            status: room.status,
            version: room.version,
            matchNumber: room.matchNumber,
            nextTurn: room.session?.nextCompetitor() ?? null,
            players: projectPlayers(room.slots),
            match: room.session
                ? projectMatch(room.modeId, room.session.snapshot())
                : null,
            intent: room.pendingShot
                ? {
                      competitor: room.pendingShot.competitor,
                      velocity: { ...room.pendingShot.velocity },
                  }
                : null,
            reconnectDeadlineMs: this.reconnectDeadline(room),
        }
    }

    private connectedStatus(room: Room): RoomState['status'] {
        if (
            Object.values(room.slots).some(
                (slot) => slot.disconnectedAt !== null,
            )
        )
            return 'paused'
        if (!room.session)
            return room.slots.opponent.socketId ? 'ready' : 'waiting'
        if (room.session.snapshot().phase === 'match-over') return 'finished'
        return 'playing'
    }

    private reconnectDeadline(room: Room): number | null {
        const deadlines = Object.values(room.slots)
            .map((slot) =>
                slot.disconnectedAt === null
                    ? null
                    : slot.disconnectedAt + RECONNECT_GRACE_MS,
            )
            .filter((value): value is number => value !== null)
        return deadlines.length > 0 ? Math.min(...deadlines) : null
    }

    private isInactive(room: Room): boolean {
        // A pausa conserva integralmente a janela de reconexão.
        if (room.status === 'paused') return false
        const timeout =
            room.status === 'finished'
                ? this.timeouts.finished
                : room.status === 'playing'
                  ? this.timeouts.idle
                  : this.timeouts.waiting
        return this.now() - room.lastActivityAt >= timeout
    }

    get activeRooms(): number {
        return this.rooms.size
    }

    private hasExpiredSlot(room: Room): boolean {
        const now = this.now()
        return Object.values(room.slots).some(
            (slot) =>
                slot.disconnectedAt !== null &&
                now > slot.disconnectedAt + RECONNECT_GRACE_MS,
        )
    }

    private roleForToken(room: Room, token: string): Competitor | null {
        if (room.slots.player.token === token) return 'player'
        if (room.slots.opponent.token === token) return 'opponent'
        return null
    }

    private membership(socketId: string): { room: Room; role: Competitor } {
        const membership = this.sockets.get(socketId)
        if (!membership)
            throw new RoomError('NOT_IN_ROOM', 'Entre numa sala primeiro.')
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
            throw new RoomError(
                'NOT_READY',
                'Esta conexão já está em uma sala.',
            )
        }
    }

    private uniqueCode(): string {
        for (let attempt = 0; attempt < 32; attempt++) {
            const candidate = this.code()
            if (!this.rooms.has(candidate)) return candidate
        }
        throw new RoomError(
            'ROOM_LIMIT',
            'Não foi possível reservar um código de sala.',
        )
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
