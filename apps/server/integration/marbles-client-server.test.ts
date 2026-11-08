import {
    CLIENT_EVENTS,
    SERVER_EVENTS,
    RECONNECT_GRACE_MS,
    type RoomState,
} from '@guess-my-move/marbles'
import type { INestApplication } from '@nestjs/common'
import type { AddressInfo } from 'node:net'
import { io, type Socket } from 'socket.io-client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { MultiplayerClient } from '../../web/src/marbles/multiplayerClient.js'
import type { ClientSocket } from '../../web/src/realtime/clientSocket.js'
import { createServerApp } from '../src/app.setup.js'
import {
    MultiplayerGateway,
    type CommandAck,
} from '../src/multiplayer/multiplayer.gateway.js'
import { RoomService } from '../src/multiplayer/room.service.js'

/** Faults only at the test boundary: all events/payloads still cross real Socket.IO. */
class AckBoundary implements ClientSocket {
    readonly socket: Socket
    private readonly delayed = new Set<string>()
    private readonly dropped = new Set<string>()
    private readonly pending = new Map<string, () => void>()
    readonly sent = new Map<string, unknown>()
    stateCount = 0

    constructor(url: string) {
        this.socket = io(url, {
            transports: ['websocket'],
            autoConnect: false,
            reconnection: false,
            forceNew: true,
            extraHeaders: { Origin: 'http://localhost:5173' },
        })
        this.socket.on(SERVER_EVENTS.state, () => {
            this.stateCount++
        })
    }
    get connected(): boolean {
        return this.socket.connected
    }
    connect(): void {
        this.socket.connect()
    }
    disconnect(): void {
        this.socket.disconnect()
    }
    on(event: string, listener: (...args: unknown[]) => void): this {
        this.socket.on(event, listener)
        return this
    }
    off(event: string, listener: (...args: unknown[]) => void): this {
        this.socket.off(event, listener)
        return this
    }
    hold(event: string): void {
        this.delayed.add(event)
    }
    drop(event: string): void {
        this.dropped.add(event)
    }
    hasAck(event: string): boolean {
        return this.pending.has(event)
    }
    release(event: string): void {
        const deliver = this.pending.get(event)
        if (!deliver) throw new Error('ACK ainda não recebido')
        this.pending.delete(event)
        this.delayed.delete(event)
        deliver()
    }
    emit(
        event: string,
        payload: unknown,
        ack?: (value: unknown) => void,
    ): this {
        this.sent.set(event, payload)
        if (!ack) this.socket.emit(event, payload)
        else
            this.socket.emit(event, payload, (value: unknown) => {
                if (this.dropped.delete(event)) return
                if (this.delayed.has(event))
                    this.pending.set(event, () => ack(value))
                else ack(value)
            })
        return this
    }
}

const peers: { client: MultiplayerClient; transport: AckBoundary }[] = []
let app: INestApplication | undefined

async function eventually<T>(
    read: () => T | undefined,
    timeoutMs = 3000,
): Promise<T> {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
        const value = read()
        if (value !== undefined) return value
        await new Promise((resolve) => setTimeout(resolve, 10))
    }
    throw new Error('Estado público esperado não chegou dentro do prazo')
}

async function server(): Promise<string> {
    app = await createServerApp({ logger: false })
    await app.listen(0, '127.0.0.1')
    const address = (
        app.getHttpServer() as { address(): AddressInfo }
    ).address()
    return `http://127.0.0.1:${address.port}`
}

function peer(url: string) {
    const transport = new AckBoundary(url)
    const client = new MultiplayerClient({ socket: transport, storage: null })
    const result = { client, transport }
    peers.push(result)
    return result
}

async function room(
    client: MultiplayerClient,
    predicate: (state: RoomState) => boolean,
) {
    return eventually(() => {
        const state = client.getSnapshot().room
        return state && predicate(state) ? state : undefined
    })
}

async function ack(
    transport: AckBoundary,
    event: string,
    payload: unknown,
): Promise<CommandAck> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(
            () => reject(new Error('ACK real não chegou')),
            3000,
        )
        transport.socket.emit(event, payload, (value: CommandAck) => {
            clearTimeout(timer)
            resolve(value)
        })
    })
}

afterEach(async () => {
    for (const { client, transport } of peers.splice(0)) {
        client.destroy()
        transport.socket.removeAllListeners()
        transport.socket.disconnect()
    }
    try {
        await app?.close()
    } finally {
        app = undefined
        vi.restoreAllMocks()
    }
})

describe('lobby: cliente de produção e servidor real', () => {
    it('publica sala e identidade juntas mesmo com create/join ACK posterior ao broadcast', async () => {
        const url = await server()
        const host = peer(url)
        host.transport.hold(CLIENT_EVENTS.create)
        const creating = host.client.createRoom('bete', 'Ana')
        await eventually(() =>
            host.transport.hasAck(CLIENT_EVENTS.create) &&
            host.transport.stateCount > 0
                ? true
                : undefined,
        )
        expect(host.client.getSnapshot().room).toBeNull()
        expect(host.client.getSnapshot().access).toBeNull()
        host.transport.release(CLIENT_EVENTS.create)
        expect(await creating).toBe(true)
        const code = host.client.getSnapshot().room!.roomCode
        expect(host.client.getSnapshot().access?.role).toBe('player')
        expect(host.client.getSnapshot().room?.players.player.nickname).toBe(
            'Ana',
        )

        const guest = peer(url)
        guest.transport.hold(CLIENT_EVENTS.join)
        const joining = guest.client.joinRoom(code.toLowerCase(), 'Bia')
        await eventually(() =>
            guest.transport.hasAck(CLIENT_EVENTS.join) &&
            guest.transport.stateCount > 0
                ? true
                : undefined,
        )
        expect(guest.client.getSnapshot().room).toBeNull()
        expect(guest.client.getSnapshot().access).toBeNull()
        await room(
            host.client,
            (state) => state.players.opponent.nickname === 'Bia',
        )
        guest.transport.release(CLIENT_EVENTS.join)
        expect(await joining).toBe(true)
        expect(guest.client.getSnapshot().access?.role).toBe('opponent')
        expect(guest.client.getSnapshot().room).toEqual(
            host.client.getSnapshot().room,
        )
        expect(app!.get(RoomService).activeRooms).toBe(1)
    })

    it('ACK de entrada perdido abandona a sala desconhecida e permite nova criação explícita', async () => {
        const realNow = Date.now.bind(Date)
        let offset = 0
        vi.spyOn(Date, 'now').mockImplementation(() => realNow() + offset)
        const url = await server()
        const host = peer(url)
        expect(await host.client.createRoom('hole', 'Ana')).toBe(true)
        const guest = peer(url)
        guest.transport.drop(CLIENT_EVENTS.join)
        const joining = guest.client.joinRoom(
            host.client.getSnapshot().room!.roomCode,
            'Bia',
        )
        await room(
            host.client,
            (state) => state.players.opponent.nickname === 'Bia',
        )
        expect(guest.client.getSnapshot().room).toBeNull()
        expect(await joining).toBe(false)
        expect(guest.client.getSnapshot().access).toBeNull()
        // Best-effort leave may be lost with disconnect: the existing reservation must expire.
        await eventually(() =>
            app!.get(RoomService).activeRooms === 0 ||
            host.client.getSnapshot().room?.status === 'paused'
                ? true
                : undefined,
        )
        offset = RECONNECT_GRACE_MS + 1
        await eventually(() =>
            app!.get(RoomService).activeRooms === 0 ? true : undefined,
        )
        await eventually(() =>
            host.client.getSnapshot().room === null ? true : undefined,
        )
        offset = 0
        expect(await guest.client.createRoom('hole', 'Bia')).toBe(true)
        expect(app!.get(RoomService).activeRooms).toBe(1)
    })

    it('retoma a mesma vaga após queda, bloqueia tiros antes do ACK e ignora resposta anterior à saída', async () => {
        const url = await server()
        const host = peer(url)
        const guest = peer(url)
        expect(await host.client.createRoom('bete', 'Ana')).toBe(true)
        const code = host.client.getSnapshot().room!.roomCode
        expect(await guest.client.joinRoom(code, 'Bia')).toBe(true)
        expect(await host.client.setReady(true)).toBe(true)
        expect(await guest.client.setReady(true)).toBe(true)
        await room(host.client, (state) => state.status === 'playing')
        const oldId = guest.transport.socket.id
        guest.transport.disconnect()
        await room(host.client, (state) => state.status === 'paused')
        guest.transport.hold(CLIENT_EVENTS.resume)
        const reconnecting = guest.client.connect()
        await eventually(() =>
            guest.transport.hasAck(CLIENT_EVENTS.resume) ? true : undefined,
        )
        expect(guest.transport.socket.id === oldId).toBe(false)
        expect(guest.client.getSnapshot().connection).toBe('connecting')
        expect(await guest.client.sendShot({ x: 150, y: 0 })).toBe(false)
        guest.transport.release(CLIENT_EVENTS.resume)
        await reconnecting
        expect(guest.client.getSnapshot().access?.role).toBe('opponent')
        expect(guest.client.getSnapshot().room?.roomCode).toBe(code)
        await room(
            host.client,
            (state) =>
                state.status === 'playing' &&
                state.players.opponent.nickname === 'Bia',
        )

        host.transport.hold(CLIENT_EVENTS.ready)
        const oldCommand = host.client.setReady(true)
        await eventually(() =>
            host.transport.hasAck(CLIENT_EVENTS.ready) ? true : undefined,
        )
        await host.client.leave()
        expect(await oldCommand).toBe(false)
        host.transport.release(CLIENT_EVENTS.ready)
        expect(host.client.getSnapshot().room).toBeNull()
        expect(host.client.getSnapshot().access).toBeNull()
        await eventually(() =>
            guest.client.getSnapshot().room === null ? true : undefined,
        )
        expect(app!.get(RoomService).activeRooms).toBe(0)
        expect(await host.client.sendShot({ x: 150, y: 0 })).toBe(false)
        const rejected = await ack(host.transport, CLIENT_EVENTS.shot, {
            seq: 1,
            matchNumber: 1,
            velocity: { x: 150, y: 0 },
        })
        expect(rejected.ok).toBe(false)
    })

    it('conclui partida e exige revanche bilateral na mesma sala, recusando tiro da partida anterior', async () => {
        const url = await server()
        const host = peer(url)
        const guest = peer(url)
        expect(await host.client.createRoom('bete', 'Ana')).toBe(true)
        const code = host.client.getSnapshot().room!.roomCode
        expect(await guest.client.joinRoom(code, 'Bia')).toBe(true)
        expect(await host.client.setReady(true)).toBe(true)
        expect(await guest.client.setReady(true)).toBe(true)
        await room(host.client, (state) => state.status === 'playing')
        const ids = [host.transport.socket.id, guest.transport.socket.id]
        const gateway = app!.get(MultiplayerGateway)
        const rooms = app!.get(RoomService)
        // Deterministic simulation clock only. Never replace snapshots, physics, commands or ACKs.
        gateway.onApplicationShutdown()
        const deadline = Date.now() + 12000
        while (
            host.client.getSnapshot().room?.status !== 'finished' &&
            Date.now() < deadline
        ) {
            const current = host.client.getSnapshot().room!
            const phase = current.match?.phase
            if (phase === 'player-turn' || phase === 'opponent-turn') {
                const shooter = phase === 'player-turn' ? host : guest
                expect(await shooter.client.sendShot({ x: 150, y: 0 })).toBe(
                    true,
                )
                // Keep the real admission limiter below 20 commands per second.
                await new Promise((resolve) => setTimeout(resolve, 70))
            }
            const before = rooms.state(code)!
            let state = before
            for (let step = 0; step < 1000; step++) {
                const result = rooms.tick(250)
                state = result.updated.at(-1) ?? state
                const next = state.match?.phase
                if (
                    (!state.intent &&
                        (next === 'player-turn' || next === 'opponent-turn')) ||
                    state.status === 'finished'
                )
                    break
            }
            gateway.server.to(code).emit(SERVER_EVENTS.state, state)
            await room(host.client, (value) => value.version >= state.version)
            await room(guest.client, (value) => value.version >= state.version)
        }
        expect(host.client.getSnapshot().room?.status).toBe('finished')
        expect(
            host.client.getSnapshot().room?.match?.roundOutcomes,
        ).toHaveLength(3)
        expect(await host.client.setRematchReady(true)).toBe(true)
        expect(host.client.getSnapshot().room?.matchNumber).toBe(1)
        expect(host.client.getSnapshot().room?.status).toBe('finished')
        expect(await guest.client.setRematchReady(true)).toBe(true)
        await room(
            host.client,
            (state) => state.status === 'playing' && state.matchNumber === 2,
        )
        await room(
            guest.client,
            (state) => state.status === 'playing' && state.matchNumber === 2,
        )
        expect(host.client.getSnapshot().room?.roomCode).toBe(code)
        expect(host.client.getSnapshot().room?.match?.roundOutcomes).toEqual([])
        expect([host.transport.socket.id, guest.transport.socket.id]).toEqual(
            ids,
        )
        expect(rooms.activeRooms).toBe(1)
        const stale = await ack(
            host.transport,
            CLIENT_EVENTS.shot,
            host.transport.sent.get(CLIENT_EVENTS.shot),
        )
        expect(stale.ok).toBe(false)
        expect(rooms.state(code)?.matchNumber).toBe(2)
    })
})
