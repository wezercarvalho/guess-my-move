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
    private readonly deferred = new Set<string>()
    private readonly pending = new Map<string, ((value: unknown) => void)[]>()

    defer(event: string): void { this.deferred.add(event) }
    reply(event: string, value: unknown): void { this.pending.get(event)?.shift()?.(value) }

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
        if (ack && this.deferred.has(event)) {
            const pending = this.pending.get(event) ?? []
            pending.push(ack)
            this.pending.set(event, pending)
        } else if (ack) ack(this.acks.get(event) ?? { ok: true })
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
            payload: { matchNumber: 1, seq: 1, velocity: { x: 300, y: 0 } },
        })
        expect(socket.emitted).toContainEqual({
            event: CLIENT_EVENTS.shot,
            payload: { matchNumber: 1, seq: 2, velocity: { x: 300, y: 0 } },
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
            payload: { matchNumber: 1, seq: 2, velocity: { x: 300, y: 0 } },
        })
    })
})

describe('MultiplayerClient: corrida de retomada', () => {
    it('não libera tiros antes do servidor confirmar a retomada', async () => {
        const socket = new FakeSocket()
        socket.respond(CLIENT_EVENTS.create, { ok: true, access })
        const client = new MultiplayerClient({ socket, storage: memoryStorage() })
        await client.createRoom('bete')
        socket.defer(CLIENT_EVENTS.resume)
        socket.disconnect()
        socket.connect()
        expect(client.getSnapshot().connection).toBe('connecting')
        await expect(client.sendShot({ x: 300, y: 0 })).resolves.toBe(false)
        expect(socket.emitted.filter(e => e.event === CLIENT_EVENTS.shot)).toHaveLength(0)
        socket.reply(CLIENT_EVENTS.resume, { ok: true, access })
        await vi.waitFor(() => expect(client.getSnapshot().connection).toBe('connected'))
        client.destroy()
    })

    it('uma confirmação antiga de retomada não desfaz a saída da sala', async () => {
        const socket = new FakeSocket()
        const storage = memoryStorage()
        socket.respond(CLIENT_EVENTS.create, { ok: true, access })
        const client = new MultiplayerClient({ socket, storage })
        await client.createRoom('bete')
        socket.defer(CLIENT_EVENTS.resume)
        socket.disconnect()
        socket.connect()
        await client.leave()
        socket.reply(CLIENT_EVENTS.resume, { ok: true, access })
        await Promise.resolve()
        await Promise.resolve()
        expect(client.getSnapshot().access).toBeNull()
        expect(storage.getItem(MULTIPLAYER_STORAGE_KEY)).toBeNull()
        client.destroy()
    })
})

describe('MultiplayerClient: cancelar entrada para jogar local', () => {
    it('não aceita uma criação confirmada depois de sair', async () => {
        const socket = new FakeSocket()
        socket.defer(CLIENT_EVENTS.create)
        const client = new MultiplayerClient({ socket, storage: memoryStorage() })
        const creation = client.createRoom('bete')
        await vi.waitFor(() => expect(socket.emitted.some(e => e.event === CLIENT_EVENTS.create)).toBe(true))
        await client.leave()
        socket.reply(CLIENT_EVENTS.create, { ok: true, access })
        await expect(creation).resolves.toBe(false)
        expect(client.getSnapshot().access).toBeNull()
        expect(socket.emitted.some(e => e.event === CLIENT_EVENTS.leave)).toBe(true)
        client.destroy()
    })

    it('não cria sala quando a conexão chega depois de escolher sair', async () => {
        const socket = new FakeSocket()
        vi.spyOn(socket, 'connect').mockImplementation(() => {})
        const client = new MultiplayerClient({ socket, storage: memoryStorage() })
        const creation = client.createRoom('bete')
        await client.leave()
        socket.connected = true
        socket.serverEmit('connect')
        await expect(creation).resolves.toBe(false)
        expect(socket.emitted.some(e => e.event === CLIENT_EVENTS.create)).toBe(false)
        client.destroy()
    })
})


it('envia apelidos e indexa a revanche pela partida atual', async () => {
    const socket=new FakeSocket()
    socket.respond(CLIENT_EVENTS.create,{ok:true,access})
    const client=new MultiplayerClient({socket,storage:memoryStorage()})
    await client.createRoom('bete','Ana')
    expect(socket.emitted).toContainEqual({event:CLIENT_EVENTS.create,payload:{modeId:'bete',nickname:'Ana'}})
    socket.serverEmit(SERVER_EVENTS.state,{...waiting,status:'finished',matchNumber:3})
    await client.setRematchReady(true)
    expect(socket.emitted).toContainEqual({event:CLIENT_EVENTS.rematch,payload:{ready:true,matchNumber:3}})
    client.destroy()
})


it('indexa tiros da revanche e preserva sequência crescente', async () => {
    const socket=new FakeSocket()
    socket.respond(CLIENT_EVENTS.create,{ok:true,access})
    const client=new MultiplayerClient({socket,storage:memoryStorage()})
    await client.createRoom('bete','Ana')
    await client.sendShot({x:150,y:0})
    socket.serverEmit(SERVER_EVENTS.state,{...waiting,status:'playing',matchNumber:2,version:100})
    await client.sendShot({x:150,y:0})
    expect(socket.emitted).toContainEqual({event:CLIENT_EVENTS.shot,payload:{seq:2,matchNumber:2,velocity:{x:150,y:0}}})
    client.destroy()
})
