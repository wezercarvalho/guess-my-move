import {
    CLIENT_EVENTS,
    SERVER_EVENTS,
    type ModeId,
    type ProtocolError,
    type RoomAccess,
    type RoomState,
    type Vec,
    normalizeRoomCode,
    protocolErrorSchema,
    roomAccessSchema,
    roomStateSchema,
} from '@guess-my-move/marbles'
import { io } from 'socket.io-client'

export const MULTIPLAYER_STORAGE_KEY = 'guess-my-move:marbles-room'
const SEQUENCE_STORAGE_KEY = `${MULTIPLAYER_STORAGE_KEY}:next-seq`
const ACK_TIMEOUT_MS = 5000

export type MultiplayerConnection = 'idle' | 'connecting' | 'connected' | 'disconnected'

export interface MultiplayerSnapshot {
    connection: MultiplayerConnection
    access: RoomAccess | null
    room: RoomState | null
    error: ProtocolError | null
}

export interface ClientSocket {
    readonly connected: boolean
    connect(): void
    disconnect(): void
    on(event: string, listener: (...args: unknown[]) => void): this
    off(event: string, listener: (...args: unknown[]) => void): this
    emit(event: string, payload: unknown, ack?: (value: unknown) => void): this
}

export interface MultiplayerStore {
    subscribe: (listener: () => void) => () => void
    getSnapshot: () => MultiplayerSnapshot
    connect(): Promise<void>
    createRoom(modeId: ModeId): Promise<boolean>
    joinRoom(roomCode: string): Promise<boolean>
    setReady(ready: boolean): Promise<boolean>
    sendShot(velocity: Vec): Promise<boolean>
    leave(): Promise<void>
    destroy(): void
}

interface CommandAck {
    ok: boolean
    access?: unknown
    error?: unknown
}

export interface MultiplayerClientOptions {
    socket?: ClientSocket
    storage?: Storage | null
}

function defaultSocket(): ClientSocket {
    return io({
        transports: ['websocket'],
        autoConnect: false,
        reconnection: true,
    })
}

const connectionError: ProtocolError = {
    code: 'INTERNAL_ERROR',
    message: 'Não foi possível conectar ao servidor.',
}

/** Conexão multiplayer sem React; todos os dados recebidos são validados. */
export class MultiplayerClient {
    private readonly socket: ClientSocket
    private readonly storage: Storage | null
    private readonly listeners = new Set<() => void>()
    private nextSeq = 1
    private resumePromise: Promise<void> | null = null
    private listening = false
    private snapshot: MultiplayerSnapshot = {
        connection: 'idle',
        access: null,
        room: null,
        error: null,
    }

    private readonly onConnect = () => {
        this.patch({ connection: 'connected', error: null })
        this.resumePromise = this.resumeSaved()
    }

    private readonly onDisconnect = () => {
        this.patch({ connection: 'disconnected' })
    }

    private readonly onConnectError = () => {
        this.patch({ connection: 'disconnected', error: connectionError })
    }

    private readonly onState = (value: unknown) => {
        const parsed = roomStateSchema.safeParse(value)
        if (!parsed.success) return
        if (
            this.snapshot.room?.roomCode === parsed.data.roomCode &&
            parsed.data.version < this.snapshot.room.version
        )
            return
        this.patch({ room: parsed.data, error: null })
    }

    private readonly onProtocolError = (value: unknown) => {
        const parsed = protocolErrorSchema.safeParse(value)
        if (!parsed.success) return
        const clear = parsed.data.code === 'ROOM_NOT_FOUND' || parsed.data.code === 'RESUME_DENIED'
        if (clear) this.clearAccess()
        this.patch({
            error: parsed.data,
            ...(clear ? { access: null, room: null } : {}),
        })
    }

    constructor(options: MultiplayerClientOptions = {}) {
        this.socket = options.socket ?? defaultSocket()
        let storage: Storage | null = options.storage ?? null
        if (options.storage === undefined) {
            try {
                storage = window.sessionStorage
            } catch {
                /* A sala funciona sem persistência. */
            }
        }
        this.storage = storage
        this.snapshot = { ...this.snapshot, access: this.readAccess() }
        this.listen()
    }

    private listen(): void {
        if (this.listening) return
        this.listening = true
        this.socket.on('connect', this.onConnect)
        this.socket.on('disconnect', this.onDisconnect)
        this.socket.on('connect_error', this.onConnectError)
        this.socket.on(SERVER_EVENTS.state, this.onState)
        this.socket.on(SERVER_EVENTS.error, this.onProtocolError)
    }

    readonly subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener)
        return () => this.listeners.delete(listener)
    }

    readonly getSnapshot = (): MultiplayerSnapshot => this.snapshot

    async connect(): Promise<void> {
        this.listen()
        if (this.socket.connected) {
            await this.resumePromise
            return
        }
        this.patch({ connection: 'connecting', error: null })
        await new Promise<void>((resolve, reject) => {
            const connected = () => {
                cleanup()
                resolve()
            }
            const failed = () => {
                cleanup()
                reject(new Error(connectionError.message))
            }
            const cleanup = () => {
                this.socket.off('connect', connected)
                this.socket.off('connect_error', failed)
            }
            this.socket.on('connect', connected)
            this.socket.on('connect_error', failed)
            this.socket.connect()
        }).catch(() => undefined)
        await this.resumePromise
    }

    async createRoom(modeId: ModeId): Promise<boolean> {
        await this.connect()
        const ack = await this.emitAck(CLIENT_EVENTS.create, { modeId })
        return this.acceptAccess(ack)
    }

    async joinRoom(roomCode: string): Promise<boolean> {
        await this.connect()
        const ack = await this.emitAck(CLIENT_EVENTS.join, {
            roomCode: normalizeRoomCode(roomCode),
        })
        return this.acceptAccess(ack)
    }

    async setReady(ready: boolean): Promise<boolean> {
        if (!this.snapshot.access) return false
        const ack = await this.emitAck(CLIENT_EVENTS.ready, { ready })
        return this.acceptAck(ack)
    }

    async sendShot(velocity: Vec): Promise<boolean> {
        if (!this.snapshot.access) return false
        const seq = this.nextSeq++
        this.writeStorage(SEQUENCE_STORAGE_KEY, String(this.nextSeq))
        const ack = await this.emitAck(CLIENT_EVENTS.shot, { seq, velocity })
        return this.acceptAck(ack)
    }

    async leave(): Promise<void> {
        if (this.snapshot.access && this.socket.connected) {
            await this.emitAck(CLIENT_EVENTS.leave, {})
        }
        this.clearAccess()
        this.nextSeq = 1
        this.patch({ access: null, room: null, error: null })
    }

    destroy(): void {
        this.socket.off('connect', this.onConnect)
        this.socket.off('disconnect', this.onDisconnect)
        this.socket.off('connect_error', this.onConnectError)
        this.socket.off(SERVER_EVENTS.state, this.onState)
        this.socket.off(SERVER_EVENTS.error, this.onProtocolError)
        this.socket.disconnect()
        this.listening = false
    }

    private async resumeSaved(): Promise<void> {
        const saved = this.snapshot.access ?? this.readAccess()
        if (!saved) return
        const ack = await this.emitAck(CLIENT_EVENTS.resume, {
            roomCode: saved.roomCode,
            resumeToken: saved.resumeToken,
        })
        this.acceptAccess(ack, true)
    }

    private acceptAccess(ack: CommandAck, resuming = false): boolean {
        if (!ack.ok) return this.acceptAck(ack)
        const parsed = roomAccessSchema.safeParse(ack.access)
        if (!parsed.success) {
            this.patch({ error: connectionError })
            return false
        }
        this.writeStorage(MULTIPLAYER_STORAGE_KEY, JSON.stringify(parsed.data))
        const savedSeq = Number(this.readStorage(SEQUENCE_STORAGE_KEY))
        this.nextSeq = resuming
            ? Math.max(this.nextSeq, Number.isSafeInteger(savedSeq) && savedSeq > 0 ? savedSeq : 1)
            : 1
        this.writeStorage(SEQUENCE_STORAGE_KEY, String(this.nextSeq))
        this.patch({ access: parsed.data, error: null })
        return true
    }

    private acceptAck(ack: CommandAck): boolean {
        if (ack.ok) {
            this.patch({ error: null })
            return true
        }
        this.onProtocolError(ack.error)
        return false
    }

    private emitAck(event: string, payload: unknown): Promise<CommandAck> {
        if (!this.socket.connected) return Promise.resolve({ ok: false, error: connectionError })
        return new Promise((resolve) => {
            const timeout = setTimeout(
                () => resolve({ ok: false, error: connectionError }),
                ACK_TIMEOUT_MS,
            )
            this.socket.emit(event, payload, (value: unknown) => {
                clearTimeout(timeout)
                if (
                    !value ||
                    typeof value !== 'object' ||
                    !('ok' in value) ||
                    typeof value.ok !== 'boolean'
                ) {
                    resolve({ ok: false, error: connectionError })
                    return
                }
                resolve(value as CommandAck)
            })
        })
    }

    private readAccess(): RoomAccess | null {
        const raw = this.readStorage(MULTIPLAYER_STORAGE_KEY)
        if (!raw) return null
        try {
            const parsed = roomAccessSchema.safeParse(JSON.parse(raw) as unknown)
            if (parsed.success) return parsed.data
        } catch {
            // Entrada corrompida é descartada abaixo.
        }
        this.clearAccess()
        return null
    }

    private clearAccess(): void {
        this.writeStorage(MULTIPLAYER_STORAGE_KEY, null)
        this.writeStorage(SEQUENCE_STORAGE_KEY, null)
    }

    private readStorage(key: string): string | null {
        try {
            return this.storage?.getItem(key) ?? null
        } catch {
            return null
        }
    }

    private writeStorage(key: string, value: string | null): void {
        try {
            if (value === null) this.storage?.removeItem(key)
            else this.storage?.setItem(key, value)
        } catch {
            /* Armazenamento bloqueado não impede jogar nesta aba. */
        }
    }

    private patch(patch: Partial<MultiplayerSnapshot>): void {
        this.snapshot = { ...this.snapshot, ...patch }
        for (const listener of this.listeners) listener()
    }
}
