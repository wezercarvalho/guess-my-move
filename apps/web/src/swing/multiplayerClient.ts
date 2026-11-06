import { swingAckSchema, swingRoomStateSchema, SWING_CLIENT_EVENTS as EVENTS, SWING_SERVER_EVENTS, type SwingAccess, type SwingAck, type SwingInput, type SwingRoomState } from '@guess-my-move/swing'
import { io } from 'socket.io-client'
import { type ClientSocket } from '../marbles/multiplayerClient.js'

export interface SwingOnlineSnapshot {
    connection: 'connecting' | 'connected' | 'disconnected'
    access: SwingAccess | null
    room: SwingRoomState | null
    error: string | null
    pending: boolean
}
export interface SwingOnlineBridge {
    getSnapshot: () => SwingOnlineSnapshot
    sendInput: (input: SwingInput) => void
}
const failed: SwingAck = { ok: false, error: { code: 'CONNECTION_ERROR', message: 'O servidor não respondeu. Tente novamente.' } }
/** Room credentials exist only in this instance, never in URLs, storage or logs. */
export class SwingMultiplayerClient implements SwingOnlineBridge {
    private snapshot: SwingOnlineSnapshot = { connection: 'connecting', access: null, room: null, error: null, pending: false }
    private readonly listeners = new Set<() => void>()
    private seq = 0
    private generation = 0
    private destroyed = false
    private readonly pendingCommands = new Set<() => void>()
    constructor(private readonly socket: ClientSocket = io('/swing', { transports: ['websocket'], autoConnect: false, reconnection: true })) {
        this.bind()
    }
    readonly subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
    readonly getSnapshot = () => this.snapshot
    private bind(): void { this.socket.on('connect', this.onConnect).on('disconnect', this.onDisconnect).on('connect_error', this.onConnectionError).on(SWING_SERVER_EVENTS.state, this.onState).on(SWING_SERVER_EVENTS.error, this.onError) }
    connect(): void {
        if (this.destroyed) { this.destroyed = false; this.bind() }
        this.socket.connect()
    }
    private patch(value: Partial<SwingOnlineSnapshot>): void { if (this.destroyed) return; this.snapshot = { ...this.snapshot, ...value }; this.listeners.forEach((listener) => listener()) }
    private readonly onError = (...args: unknown[]) => {
        const result = swingAckSchema.safeParse({ ok: false, error: args[0] })
        if (!result.success || result.data.ok) return
        if (result.data.error.code === 'room-expired') {
            this.generation++
            this.seq = 0
            for (const cancel of this.pendingCommands) cancel()
            this.patch({ access: null, room: null, pending: false, error: result.data.error.message })
        } else this.patch({ error: result.data.error.message })
    }
    private readonly onConnectionError = () => this.patch({ connection: 'disconnected', error: 'Não foi possível conectar. Tentando novamente…' })
    private readonly onDisconnect = () => this.patch({ connection: 'disconnected', pending: false })
    private readonly onConnect = () => {
        const access = this.snapshot.access
        if (!access) { this.patch({ connection: 'connected', error: null }); return }
        const generation = this.generation
        this.patch({ connection: 'connecting' })
        void this.command(EVENTS.resume, { roomCode: access.roomCode, resumeToken: access.resumeToken }).then((ack) => {
            if (generation !== this.generation) return
            this.patch(ack.ok ? { connection: 'connected', error: null } : { connection: 'connected', access: null, room: null, error: ack.error.message })
        })
    }
    private readonly onState = (...args: unknown[]) => {
        const parsed = swingRoomStateSchema.safeParse(args[0])
        if (!parsed.success || (!this.snapshot.access && !this.snapshot.pending)) return
        const room: SwingRoomState = parsed.data
        const previous = this.snapshot.room
        if (this.snapshot.access && room.roomCode !== this.snapshot.access.roomCode) return
        if (previous && previous.roomCode === room.roomCode && (room.round < previous.round || (room.round === previous.round && room.tick < previous.tick))) return
        this.patch({ room })
    }
    private command(event: string, payload: unknown): Promise<SwingAck> {
        return new Promise((resolve) => {
            if (!this.socket.connected) { resolve(failed); return }
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
        const ack = await this.command(event, payload)
        if (generation !== this.generation) return false
        this.patch({ pending: false, ...(ack.ok ? (ack.access ? { access: ack.access } : {}) : { error: ack.error.message }) })
        return ack.ok
    }
    create(cityId: string, nickname: string): Promise<boolean> { return this.action(EVENTS.create, { cityId, nickname }) }
    join(roomCode: string, nickname: string): Promise<boolean> { return this.action(EVENTS.join, { roomCode: roomCode.trim().toUpperCase(), nickname }) }
    ready(ready: boolean): Promise<boolean> { return this.action(EVENTS.ready, { ready }) }
    rematch(): Promise<boolean> { return this.action(EVENTS.rematch, { round: this.snapshot.room?.round }) }
    readonly sendInput = (input: SwingInput): void => {
        const room = this.snapshot.room
        if (!room || room.status !== 'playing' || this.snapshot.connection !== 'connected') return
        this.socket.emit(EVENTS.input, { round: room.round, seq: ++this.seq, input })
    }
    leave(): void {
        if (this.socket.connected) this.socket.emit(EVENTS.leave, {})
        this.generation++
        for (const cancel of this.pendingCommands) cancel()
        this.patch({ access: null, room: null, pending: false, error: null })
    }
    destroy(): void {
        this.leave()
        this.destroyed = true
        this.socket.off('connect', this.onConnect).off('disconnect', this.onDisconnect).off('connect_error', this.onConnectionError).off(SWING_SERVER_EVENTS.state, this.onState).off(SWING_SERVER_EVENTS.error, this.onError)
        this.socket.disconnect()
        this.listeners.clear()
    }
}
