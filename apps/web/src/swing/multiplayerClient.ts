import {
    swingAckSchema,
    swingRoomStateSchema,
    SWING_CLIENT_EVENTS as EVENTS,
    SWING_SERVER_EVENTS,
    type SwingAccess,
    type SwingAck,
    type SwingInput,
    type SwingRoomState,
} from '@guess-my-move/swing'
import { io } from 'socket.io-client'
import { type ClientSocket } from '../marbles/multiplayerClient.js'

export interface SwingOnlineSnapshot {
    connection: 'connecting' | 'connected' | 'disconnected'
    access: SwingAccess | null
    room: SwingRoomState | null
    error: string | null
    pending: boolean
    stale: boolean
}
export interface SwingOnlineBridge {
    getSnapshot: () => SwingOnlineSnapshot
    sendInput: (input: SwingInput) => void
}
const UPDATES_TIMEOUT_MS = 2000
const failed: SwingAck = {
    ok: false,
    error: {
        code: 'CONNECTION_ERROR',
        message: 'O servidor não respondeu. Tente novamente.',
    },
}
/** Room credentials exist only in this instance, never in URLs, storage or logs. */
export class SwingMultiplayerClient implements SwingOnlineBridge {
    private snapshot: SwingOnlineSnapshot = {
        connection: 'connecting',
        access: null,
        room: null,
        error: null,
        pending: false,
        stale: false,
    }
    private readonly listeners = new Set<() => void>()
    private seq = 0
    private generation = 0
    private updatesTimer: ReturnType<typeof setTimeout> | null = null
    private destroyed = false
    private readonly pendingCommands = new Set<() => void>()
    constructor(
        private readonly socket: ClientSocket = io('/swing', {
            transports: ['websocket'],
            autoConnect: false,
            reconnection: true,
        }),
    ) {
        this.bind()
    }
    readonly subscribe = (listener: () => void) => {
        this.listeners.add(listener)
        return () => {
            this.listeners.delete(listener)
        }
    }
    readonly getSnapshot = () => this.snapshot
    private bind(): void {
        this.socket
            .on('connect', this.onConnect)
            .on('disconnect', this.onDisconnect)
            .on('connect_error', this.onConnectionError)
            .on(SWING_SERVER_EVENTS.state, this.onState)
            .on(SWING_SERVER_EVENTS.error, this.onError)
    }
    connect(): void {
        if (this.destroyed) {
            this.destroyed = false
            this.bind()
        }
        if (this.socket.connected) this.onConnect()
        else this.socket.connect()
    }
    private patch(value: Partial<SwingOnlineSnapshot>): void {
        if (this.destroyed) return
        this.snapshot = { ...this.snapshot, ...value }
        this.listeners.forEach((listener) => listener())
    }
    private clearUpdatesWatchdog(): void {
        if (this.updatesTimer !== null) clearTimeout(this.updatesTimer)
        this.updatesTimer = null
    }
    private watchUpdates(progress: boolean): void {
        if (
            this.destroyed ||
            this.snapshot.connection !== 'connected' ||
            this.snapshot.room?.status !== 'playing'
        ) {
            this.clearUpdatesWatchdog()
            return
        }
        if (!progress) return
        this.clearUpdatesWatchdog()
        this.updatesTimer = setTimeout(() => {
            this.updatesTimer = null
            this.patch({ stale: true })
        }, UPDATES_TIMEOUT_MS)
    }
    private invalidateCommands(): void {
        this.generation++
        for (const cancel of this.pendingCommands) cancel()
    }
    private readonly onError = (...args: unknown[]) => {
        const result = swingAckSchema.safeParse({ ok: false, error: args[0] })
        if (!result.success || result.data.ok) return
        if (result.data.error.code === 'room-expired') {
            this.invalidateCommands()
            this.clearUpdatesWatchdog()
            this.seq = 0
            this.patch({
                access: null,
                room: null,
                pending: false,
                stale: false,
                error: result.data.error.message,
            })
        } else this.patch({ error: result.data.error.message })
    }
    private readonly onConnectionError = () =>
        this.patch({
            connection: 'disconnected',
            error: 'Não foi possível conectar. Tentando novamente…',
        })
    private readonly onDisconnect = () => {
        this.invalidateCommands()
        this.clearUpdatesWatchdog()
        this.patch({
            connection: 'disconnected',
            pending: false,
            stale: false,
            room: this.snapshot.access ? this.snapshot.room : null,
        })
    }
    private readonly onConnect = () => {
        const access = this.snapshot.access
        if (!access) {
            this.patch({
                connection: 'connected',
                error: null,
                room: null,
                stale: false,
            })
            return
        }
        const generation = this.generation
        this.patch({ connection: 'connecting' })
        void this.retry(generation, () =>
            this.command(EVENTS.resume, {
                roomCode: access.roomCode,
                resumeToken: access.resumeToken,
            }),
        ).then((ack) => {
            if (generation !== this.generation) return
            this.patch(
                ack.ok
                    ? { connection: 'connected', error: null, stale: false }
                    : this.transient(ack)
                      ? {
                            connection: 'disconnected',
                            stale: false,
                            error: 'Não foi possível confirmar a retomada. Aguarde a reconexão ou saia da sala.',
                        }
                      : {
                            connection: 'connected',
                            access: null,
                            room: null,
                            stale: false,
                            error: ack.error.message,
                        },
            )
            this.watchUpdates(true)
        })
    }
    private readonly onState = (...args: unknown[]) => {
        const parsed = swingRoomStateSchema.safeParse(args[0])
        if (
            !parsed.success ||
            (!this.snapshot.access && !this.snapshot.pending)
        )
            return
        const room: SwingRoomState = parsed.data
        const previous = this.snapshot.room
        if (
            this.snapshot.access &&
            room.roomCode !== this.snapshot.access.roomCode
        )
            return
        if (
            previous &&
            previous.roomCode === room.roomCode &&
            (room.round < previous.round ||
                (room.round === previous.round && room.tick < previous.tick))
        )
            return
        const progress =
            !previous ||
            previous.roomCode !== room.roomCode ||
            room.round > previous.round ||
            room.tick > previous.tick ||
            previous.status !== room.status
        this.patch({
            room,
            stale:
                room.status === 'playing' && !progress
                    ? this.snapshot.stale
                    : false,
        })
        this.watchUpdates(progress)
    }
    private transient(ack: SwingAck): boolean {
        return (
            !ack.ok &&
            [
                'CONNECTION_ERROR',
                'internal-error',
                'rate-limited',
                'already-connected',
            ].includes(ack.error.code)
        )
    }
    private pauseRetry(): Promise<void> {
        return new Promise((resolve) => {
            const finish = () => {
                clearTimeout(timer)
                this.pendingCommands.delete(finish)
                resolve()
            }
            const timer = setTimeout(finish, 500)
            this.pendingCommands.add(finish)
        })
    }
    private async retry(
        generation: number,
        attempt: () => Promise<SwingAck>,
    ): Promise<SwingAck> {
        let ack: SwingAck = failed
        for (let count = 0; count < 3; count++) {
            if (generation !== this.generation || this.destroyed) return failed
            if (count > 0) await this.pauseRetry()
            if (generation !== this.generation || this.destroyed) return failed
            ack = await attempt()
            if (!this.transient(ack)) return ack
        }
        return ack
    }
    private command(event: string, payload: unknown): Promise<SwingAck> {
        return new Promise((resolve) => {
            if (!this.socket.connected) {
                resolve(failed)
                return
            }
            const finish = (ack: SwingAck) => {
                clearTimeout(timer)
                this.pendingCommands.delete(cancel)
                resolve(ack)
            }
            const cancel = () => finish(failed)
            const timer = setTimeout(cancel, 5000)
            this.pendingCommands.add(cancel)
            this.socket.emit(event, payload, (raw) => {
                if (!this.pendingCommands.has(cancel)) return
                const ack = swingAckSchema.safeParse(raw)
                finish(ack.success ? ack.data : failed)
            })
        })
    }
    async action(event: string, payload: unknown): Promise<boolean> {
        if (this.snapshot.pending) return false
        const generation = this.generation
        this.patch({ pending: true, error: null })
        let ack = await this.command(event, payload)
        if (generation !== this.generation) return false
        const entering = event === EVENTS.create || event === EVENTS.join
        if (entering && this.transient(ack)) {
            this.patch({
                error: 'Confirmando sua participação com o servidor…',
            })
            ack = await this.retry(generation, async () => {
                const recovered = await this.command(EVENTS.recover, {})
                return recovered.ok && !recovered.access ? failed : recovered
            })
            if (generation !== this.generation) return false
        }
        if (entering && !ack.ok) {
            // Do not automatically repeat a creation that may already have happened.
            if (this.transient(ack) && this.socket.connected) {
                this.socket.emit(EVENTS.leave, {})
                this.socket.disconnect()
                this.onDisconnect()
                this.socket.connect()
            }
            this.patch({
                pending: false,
                room: null,
                access: null,
                stale: false,
                error: 'Não foi possível confirmar sua participação. Tente entrar novamente.',
            })
            return false
        }
        this.patch({
            pending: false,
            ...(ack.ok
                ? ack.access
                    ? { access: ack.access }
                    : {}
                : { error: ack.error.message }),
        })
        return ack.ok
    }
    create(cityId: string, nickname: string): Promise<boolean> {
        return this.action(EVENTS.create, { cityId, nickname })
    }
    join(roomCode: string, nickname: string): Promise<boolean> {
        return this.action(EVENTS.join, {
            roomCode: roomCode.trim().toUpperCase(),
            nickname,
        })
    }
    ready(ready: boolean): Promise<boolean> {
        return this.action(EVENTS.ready, { ready })
    }
    rematch(): Promise<boolean> {
        return this.action(EVENTS.rematch, { round: this.snapshot.room?.round })
    }
    readonly sendInput = (input: SwingInput): void => {
        const room = this.snapshot.room
        if (
            !room ||
            room.status !== 'playing' ||
            this.snapshot.connection !== 'connected' ||
            this.snapshot.stale
        )
            return
        this.socket.emit(EVENTS.input, {
            round: room.round,
            seq: ++this.seq,
            input,
        })
    }
    leave(): void {
        if (this.socket.connected) this.socket.emit(EVENTS.leave, {})
        this.invalidateCommands()
        this.clearUpdatesWatchdog()
        this.patch({
            access: null,
            room: null,
            pending: false,
            error: null,
            stale: false,
        })
    }
    destroy(): void {
        this.leave()
        this.destroyed = true
        this.socket
            .off('connect', this.onConnect)
            .off('disconnect', this.onDisconnect)
            .off('connect_error', this.onConnectionError)
            .off(SWING_SERVER_EVENTS.state, this.onState)
            .off(SWING_SERVER_EVENTS.error, this.onError)
        this.socket.disconnect()
        this.listeners.clear()
    }
}
