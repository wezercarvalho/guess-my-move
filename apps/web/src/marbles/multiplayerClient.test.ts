import {
    CLIENT_EVENTS,
    SERVER_EVENTS,
    type RoomAccess,
    type RoomState,
} from '@guess-my-move/marbles'
import { describe, expect, it, vi } from 'vitest'

import {
    MULTIPLAYER_STORAGE_KEY,
    MultiplayerClient,
    type ClientSocket,
} from './multiplayerClient.js'

class FakeSocket implements ClientSocket {
    connected = false
    readonly emitted: { event: string; payload: unknown }[] = []
    private readonly listeners = new Map<string, Set<(...args: unknown[]) => void>>()
    private readonly acks = new Map<string, unknown>()

    respond(event: string, value: unknown): void {
        this.acks.set(event, value)
    }

    connect(): void {
        this.connected = true
        this.serverEmit('connect')
    }

    disconnect(): void {
        this.connected = false
        this.serverEmit('disconnect', 'client disconnect')
    }

    on(event: string, listener: (...args: unknown[]) => void): this {
        const group = this.listeners.get(event) ?? new Set()
        group.add(listener)
        this.listeners.set(event, group)
        return this
    }

    off(event: string, listener: (...args: unknown[]) => void): this {
        this.listeners.get(event)?.delete(listener)
        return this
    }

    emit(event: string, payload: unknown, ack?: (value: unknown) => void): this {
        this.emitted.push({ event, payload })
        if (ack) ack(this.acks.get(event) ?? { ok: true })
        return this
    }

    serverEmit(event: string, ...args: unknown[]): void {
        for (const listener of this.listeners.get(event) ?? []) listener(...args)
    }
}

function memoryStorage(initial?: RoomAccess): Storage {
    const values = new Map<string, string>()
    if (initial) values.set(MULTIPLAYER_STORAGE_KEY, JSON.stringify(initial))
    return {
        get length() {
            return values.size
        },
        clear: () => values.clear(),
        getItem: (key) => values.get(key) ?? null,
        key: (index) => [...values.keys()][index] ?? null,
        removeItem: (key) => values.delete(key),
        setItem: (key, value) => values.set(key, value),
    }
}

const access: RoomAccess = {
    roomCode: 'ABCDEF',
    role: 'player',
    resumeToken: 'a'.repeat(32),
}

const waiting: RoomState = {
    roomCode: 'ABCDEF',
    modeId: 'bete',
    status: 'waiting',
    version: 0,
    players: {
        player: { connected: true, ready: false },
        opponent: { connected: false, ready: false },
    },
    match: null,
    intent: null,
    reconnectDeadlineMs: null,
}

describe('MultiplayerClient', () => {
    it('conecta, cria sala, guarda o acesso e aceita estado validado', async () => {
        const socket = new FakeSocket()
        const storage = memoryStorage()
        socket.respond(CLIENT_EVENTS.create, { ok: true, access })
        const client = new MultiplayerClient({ socket, storage })
        const listener = vi.fn()
        client.subscribe(listener)

        await client.connect()
        expect(client.getSnapshot().connection).toBe('connected')
        await expect(client.createRoom('bete')).resolves.toBe(true)
        expect(JSON.parse(storage.getItem(MULTIPLAYER_STORAGE_KEY) ?? '')).toEqual(access)

        socket.serverEmit(SERVER_EVENTS.state, waiting)
        expect(client.getSnapshot()).toMatchObject({ access, room: waiting, error: null })
        expect(listener).toHaveBeenCalled()
    })

    it('ignora estado inválido e versão anterior', async () => {
        const socket = new FakeSocket()
        const client = new MultiplayerClient({ socket, storage: memoryStorage() })
        await client.connect()
        socket.serverEmit(SERVER_EVENTS.state, { ...waiting, version: 2 })
        socket.serverEmit(SERVER_EVENTS.state, { ...waiting, version: 1 })
        socket.serverEmit(SERVER_EVENTS.state, { ...waiting, version: 3, frame: 'bytes' })
        expect(client.getSnapshot().room?.version).toBe(2)
    })

    it('numera tiros, envia prontidão e limpa a sala ao sair', async () => {
        const socket = new FakeSocket()
        const storage = memoryStorage()
        socket.respond(CLIENT_EVENTS.create, { ok: true, access })
        const client = new MultiplayerClient({ socket, storage })
        await client.connect()
        await client.createRoom('bete')
        await client.setReady(true)
        await client.sendShot({ x: 300, y: 0 })
        await client.sendShot({ x: 300, y: 0 })

        expect(socket.emitted).toContainEqual({
            event: CLIENT_EVENTS.ready,
            payload: { ready: true },
        })
        expect(socket.emitted).toContainEqual({
            event: CLIENT_EVENTS.shot,
            payload: { seq: 1, velocity: { x: 300, y: 0 } },
        })
        expect(socket.emitted).toContainEqual({
            event: CLIENT_EVENTS.shot,
            payload: { seq: 2, velocity: { x: 300, y: 0 } },
        })

        await client.leave()
        expect(storage.getItem(MULTIPLAYER_STORAGE_KEY)).toBeNull()
        expect(client.getSnapshot()).toMatchObject({ access: null, room: null })
    })

    it('retoma automaticamente o acesso salvo ao reconectar', async () => {
        const socket = new FakeSocket()
        const storage = memoryStorage(access)
        socket.respond(CLIENT_EVENTS.resume, { ok: true, access })
        const client = new MultiplayerClient({ socket, storage })
        await client.connect()
        await vi.waitFor(() => {
            expect(socket.emitted).toContainEqual({
                event: CLIENT_EVENTS.resume,
                payload: { roomCode: access.roomCode, resumeToken: access.resumeToken },
            })
        })
        expect(client.getSnapshot().access).toEqual(access)
    })

    it('expõe erro sanitizado e limpa acesso de sala inexistente', async () => {
        const socket = new FakeSocket()
        const storage = memoryStorage(access)
        const client = new MultiplayerClient({ socket, storage })
        await client.connect()
        socket.serverEmit(SERVER_EVENTS.error, {
            code: 'ROOM_NOT_FOUND',
            message: 'Sala não encontrada.',
        })
        expect(client.getSnapshot().error).toEqual({
            code: 'ROOM_NOT_FOUND',
            message: 'Sala não encontrada.',
        })
        expect(client.getSnapshot().access).toBeNull()
        expect(storage.getItem(MULTIPLAYER_STORAGE_KEY)).toBeNull()
    })
    it('retoma também após cair com acesso já carregado em memória', async () => {
        const socket = new FakeSocket()
        socket.respond(CLIENT_EVENTS.create, { ok: true, access })
        socket.respond(CLIENT_EVENTS.resume, { ok: true, access })
        const client = new MultiplayerClient({ socket, storage: memoryStorage() })
        await client.createRoom('bete')
        socket.disconnect()
        socket.connect()
        await vi.waitFor(() =>
            expect(socket.emitted.filter((e) => e.event === CLIENT_EVENTS.resume)).toHaveLength(1),
        )
    })

    it('preserva a sequência dos tiros após recarregar a aba', async () => {
        const socket = new FakeSocket()
        const storage = memoryStorage()
        socket.respond(CLIENT_EVENTS.create, { ok: true, access })
        const client = new MultiplayerClient({ socket, storage })
        await client.createRoom('bete')
        await client.sendShot({ x: 300, y: 0 })
        client.destroy()
        const nextSocket = new FakeSocket()
        nextSocket.respond(CLIENT_EVENTS.resume, { ok: true, access })
        const next = new MultiplayerClient({ socket: nextSocket, storage })
        await next.connect()
        await vi.waitFor(() => expect(next.getSnapshot().access).toEqual(access))
        await next.sendShot({ x: 300, y: 0 })
        expect(nextSocket.emitted).toContainEqual({
            event: CLIENT_EVENTS.shot,
            payload: { seq: 2, velocity: { x: 300, y: 0 } },
        })
    })
})
