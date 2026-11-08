import { createCooperativeObjectives } from './cooperative-objectives.js'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import {
    createSwingWorld,
    NEUTRAL_SWING_INPUT,
    type SwingAccess,
    type SwingCommand,
    type SwingInput,
    type SwingRoomState,
    type SwingWorld,
} from '@guess-my-move/swing'
import {
    loadSwingCity,
    type SwingCity,
    type SwingCityLoader,
} from './city-catalog.js'

export class SwingRoomError extends Error {
    constructor(
        readonly code: string,
        message: string,
    ) {
        super(message)
        this.name = 'SwingRoomError'
    }
}
interface Player {
    id: string
    nickname: string
    token: string
    socketId: string | null
    ready: boolean
    rematchReady: boolean
    disconnectedAt: number | null
    world: SwingWorld
    seq: number
    input: SwingInput
    inputAt: number
}
interface Room {
    code: string
    cityId: string
    city: SwingCity
    round: number
    tick: number
    status: SwingRoomState['status']
    beforePause: SwingRoomState['status']
    players: Player[]
    objectives: SwingRoomState['objectives']
    activityAt: number
    accumulator: number
}
export interface SwingRoomOptions {
    now?: () => number
    code?: () => string
    token?: () => string
    city?: SwingCityLoader
    canCreateRoom?: () => boolean
    maxRooms?: number
    waitingTimeoutMs?: number
    idleTimeoutMs?: number
    finishedTimeoutMs?: number
    world?: (city: SwingCity) => SwingWorld
}
const GRACE_MS = 60_000
const fail = (code: string, message: string): never => {
    throw new SwingRoomError(code, message)
}
export class SwingRoomService {
    private readonly rooms = new Map<string, Room>()
    private readonly expiredCodes: string[] = []
    private readonly membership = new Map<
        string,
        { room: Room; player: Player }
    >()
    private readonly now: () => number
    constructor(private readonly options: SwingRoomOptions = {}) {
        this.now = options.now ?? Date.now
    }
    get activeRooms(): number {
        return this.rooms.size
    }
    roomCode(socketId: string): string | null {
        return this.membership.get(socketId)?.room.code ?? null
    }
    private bound(socketId: string): { room: Room; player: Player } {
        return (
            this.membership.get(socketId) ??
            fail('not-in-room', 'Entre em uma sala primeiro.')
        )
    }
    private checkFree(socketId: string): void {
        if (this.membership.has(socketId))
            fail('already-in-room', 'Saia da sala atual primeiro.')
    }
    private player(
        socketId: string,
        nickname: string,
        city: SwingCity,
    ): Player {
        return {
            id: randomBytes(12).toString('hex'),
            nickname,
            token: this.options.token?.() ?? randomBytes(32).toString('hex'),
            socketId,
            ready: false,
            rematchReady: false,
            disconnectedAt: null,
            world:
                this.options.world?.(city) ??
                createSwingWorld(city.index, city.config),
            seq: -1,
            input: NEUTRAL_SWING_INPUT,
            inputAt: this.now(),
        }
    }
    private access(room: Room, player: Player): SwingAccess {
        return {
            roomCode: room.code,
            playerId: player.id,
            resumeToken: player.token,
        }
    }
    create(
        socketId: string,
        command: { cityId: string; nickname: string },
    ): SwingAccess {
        this.checkFree(socketId)
        this.expire()
        if (
            this.rooms.size >= (this.options.maxRooms ?? 100) ||
            this.options.canCreateRoom?.() === false
        )
            fail('capacity', 'Não há vagas para novas salas agora.')
        let code = ''
        for (let attempt = 0; attempt < 20; attempt++) {
            code =
                this.options.code?.() ??
                randomBytes(3).toString('hex').toUpperCase()
            if (!this.rooms.has(code)) break
        }
        if (this.rooms.has(code))
            fail('capacity', 'Não foi possível criar uma sala agora.')
        const city = (this.options.city ?? loadSwingCity)(command.cityId)
        const player = this.player(socketId, command.nickname, city)
        const room: Room = {
            code,
            cityId: command.cityId,
            city,
            round: 1,
            tick: 0,
            status: 'waiting',
            beforePause: 'waiting',
            players: [player],
            objectives: [],
            activityAt: this.now(),
            accumulator: 0,
        }
        room.objectives = this.objectives(room)
        this.rooms.set(code, room)
        this.membership.set(socketId, { room, player })
        return this.access(room, player)
    }
    join(
        socketId: string,
        command: { roomCode: string; nickname: string },
    ): SwingAccess {
        this.checkFree(socketId)
        this.expire()
        const room =
            this.rooms.get(command.roomCode) ??
            fail('room-not-found', 'Sala não encontrada ou expirada.')
        if (room.players.length >= 2)
            fail('room-full', 'Esta sala já tem duas pessoas.')
        if (room.status !== 'waiting')
            fail('room-started', 'Esta partida já começou.')
        const player = this.player(socketId, command.nickname, room.city)
        room.players.push(player)
        room.activityAt = this.now()
        this.membership.set(socketId, { room, player })
        return this.access(room, player)
    }
    recover(socketId: string): SwingAccess {
        this.expire()
        const { room, player } = this.bound(socketId)
        return this.access(room, player)
    }
    resume(
        socketId: string,
        command: { roomCode: string; resumeToken: string },
    ): SwingAccess {
        this.expire()
        const existing = this.membership.get(socketId)
        if (existing) {
            const stored = Buffer.from(existing.player.token)
            const supplied = Buffer.from(command.resumeToken)
            if (
                existing.room.code === command.roomCode &&
                stored.length === supplied.length &&
                timingSafeEqual(stored, supplied)
            )
                return this.access(existing.room, existing.player)
            fail('invalid-token', 'Não foi possível retomar esta vaga.')
        }
        this.checkFree(socketId)
        const room =
            this.rooms.get(command.roomCode) ??
            fail('room-not-found', 'Sala não encontrada ou expirada.')
        const token = Buffer.from(command.resumeToken)
        const player =
            room.players.find((candidate) => {
                const stored = Buffer.from(candidate.token)
                return (
                    stored.length === token.length &&
                    timingSafeEqual(stored, token)
                )
            }) ?? fail('invalid-token', 'Não foi possível retomar esta vaga.')
        if (player.socketId !== null)
            fail('already-connected', 'Esta vaga já está conectada.')
        player.socketId = socketId
        player.disconnectedAt = null
        player.input = NEUTRAL_SWING_INPUT
        player.seq = -1
        this.membership.set(socketId, { room, player })
        room.activityAt = this.now()
        if (room.players.every((entry) => entry.socketId !== null))
            room.status = room.beforePause
        return this.access(room, player)
    }
    ready(socketId: string, ready: boolean): void {
        const { room, player } = this.bound(socketId)
        if (room.status !== 'waiting')
            fail('invalid-state', 'A partida não está aguardando o início.')
        if (player.ready !== ready) room.activityAt = this.now()
        player.ready = ready
        if (
            room.players.length === 2 &&
            room.players.every(
                (entry) => entry.ready && entry.socketId !== null,
            )
        )
            room.status = 'playing'
    }
    input(socketId: string, command: SwingCommand): void {
        const { room, player } = this.bound(socketId)
        if (room.status !== 'playing')
            fail('invalid-state', 'Aguarde a partida estar em andamento.')
        if (command.round !== room.round)
            fail('stale-round', 'O comando pertence a outra partida.')
        if (command.seq <= player.seq)
            fail('stale-command', 'Este comando já foi processado.')
        player.seq = command.seq
        player.input = command.input as SwingInput
        player.inputAt = this.now()
        const input = command.input
        const active =
            Object.values(input.held).some(Boolean) ||
            Object.values(input.pull ?? {}).some(Boolean) ||
            Object.values(input.grab ?? {}).some(Boolean) ||
            Boolean(
                input.climb ||
                input.releaseFist ||
                input.yawRate ||
                input.pitchRate ||
                input.lookDelta?.yaw ||
                input.lookDelta?.pitch,
            )
        if (active) room.activityAt = this.now()
    }
    rematch(socketId: string, round: number): void {
        const { room, player } = this.bound(socketId)
        if (room.status !== 'finished' || room.round !== round)
            fail('invalid-state', 'Aguarde o fim desta partida.')
        if (!player.rematchReady) room.activityAt = this.now()
        player.rematchReady = true
        if (
            !room.players.every(
                (entry) => entry.rematchReady && entry.socketId !== null,
            )
        )
            return
        room.round++
        room.tick = 0
        room.accumulator = 0
        for (const entry of room.players) {
            entry.world.reset()
            entry.ready = true
            entry.rematchReady = false
            entry.seq = -1
            entry.input = NEUTRAL_SWING_INPUT
        }
        room.objectives = this.objectives(room)
        room.status = 'playing'
    }
    disconnect(socketId: string): void {
        const bound = this.membership.get(socketId)
        if (!bound) return
        const { room, player } = bound
        this.membership.delete(socketId)
        player.socketId = null
        player.disconnectedAt = this.now()
        player.input = NEUTRAL_SWING_INPUT
        if (room.status !== 'paused') {
            room.beforePause = room.status
            room.status = 'paused'
        }
        room.accumulator = 0
    }
    leave(socketId: string): void {
        const { room, player } = this.bound(socketId)
        this.membership.delete(socketId)
        room.players = room.players.filter((entry) => entry !== player)
        if (room.players.length === 0) {
            this.rooms.delete(room.code)
            return
        }
        room.status = 'waiting'
        room.beforePause = 'waiting'
        room.round++
        room.tick = 0
        room.activityAt = this.now()
        room.accumulator = 0
        for (const entry of room.players) {
            entry.world.reset()
            entry.ready = false
            entry.rematchReady = false
            entry.input = NEUTRAL_SWING_INPUT
            entry.seq = -1
        }
        room.objectives = this.objectives(room)
        if (room.players.some((entry) => entry.socketId === null)) {
            room.beforePause = 'waiting'
            room.status = 'paused'
        }
    }
    private objectives(room: Room): SwingRoomState['objectives'] {
        const origin = room.players[0]?.world.state.position ?? {
            x: 0,
            y: 90,
            z: 0,
        }
        return createCooperativeObjectives(room.city, origin)
    }
    advance(elapsedMs: number): void {
        this.expire()
        for (const room of this.rooms.values()) {
            if (room.status !== 'playing') continue
            const step = room.city.config.step
            room.accumulator += Math.min(Math.max(0, elapsedMs), 100) / 1000
            while (room.accumulator >= step && room.status === 'playing') {
                for (const player of room.players) {
                    const input =
                        this.now() - player.inputAt > 350
                            ? NEUTRAL_SWING_INPUT
                            : player.input
                    player.world.step(input, step)
                    if (player.input.lookDelta) {
                        const { lookDelta: _lookDelta, ...continuous } =
                            player.input
                        player.input = continuous
                    }
                    for (const objective of room.objectives)
                        if (
                            objective.collectedBy === null &&
                            Math.hypot(
                                player.world.state.position.x -
                                    objective.position.x,
                                player.world.state.position.y -
                                    objective.position.y,
                                player.world.state.position.z -
                                    objective.position.z,
                            ) <= 7
                        )
                            objective.collectedBy = player.id
                }
                room.tick++
                room.accumulator -= step
                if (
                    room.objectives.every(
                        (objective) => objective.collectedBy !== null,
                    )
                ) {
                    room.status = 'finished'
                    room.activityAt = this.now()
                }
            }
        }
    }
    expire(): number {
        let expired = 0
        for (const room of this.rooms.values()) {
            const timeout =
                room.status === 'paused'
                    ? Infinity
                    : room.status === 'waiting'
                      ? (this.options.waitingTimeoutMs ?? 300_000)
                      : room.status === 'finished'
                        ? (this.options.finishedTimeoutMs ?? 300_000)
                        : (this.options.idleTimeoutMs ?? 900_000)
            const disconnected = room.players.some(
                (entry) =>
                    entry.disconnectedAt !== null &&
                    this.now() - entry.disconnectedAt >= GRACE_MS,
            )
            if (!disconnected && this.now() - room.activityAt < timeout)
                continue
            for (const entry of room.players)
                if (entry.socketId) this.membership.delete(entry.socketId)
            this.rooms.delete(room.code)
            this.expiredCodes.push(room.code)
            expired++
        }
        return expired
    }
    drainExpired(): string[] {
        return this.expiredCodes.splice(0)
    }
    snapshot(code: string): SwingRoomState | null {
        const room = this.rooms.get(code)
        if (!room) return null
        return {
            roomCode: code,
            cityId: room.cityId,
            cityVersion: 1,
            round: room.round,
            tick: room.tick,
            status: room.status,
            players: room.players.map((entry) => ({
                id: entry.id,
                nickname: entry.nickname,
                connected: entry.socketId !== null,
                ready: entry.ready,
                rematchReady: entry.rematchReady,
                state: structuredClone(entry.world.state),
            })),
            objectives: structuredClone(room.objectives),
        }
    }
    snapshots(): SwingRoomState[] {
        return [...this.rooms.keys()].flatMap((code) => {
            const state = this.snapshot(code)
            return state ? [state] : []
        })
    }
}
