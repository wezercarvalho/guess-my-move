import {
    CLIENT_EVENTS,
    MAX_SOCKET_PAYLOAD_BYTES,
    SERVER_EVENTS,
    type ProtocolError,
    type RoomAccess,
    type RoomState,
    protocolErrorSchema,
    roomStateSchema,
} from '@guess-my-move/marbles'
import { type INestApplication } from '@nestjs/common'
import { type AddressInfo } from 'node:net'
import { io, type Socket } from 'socket.io-client'
import { afterEach, describe, expect, it } from 'vitest'

import { createServerApp } from '../src/app.setup.js'
import { type CommandAck } from '../src/multiplayer/multiplayer.gateway.js'

const sockets: Socket[] = []
let app: INestApplication | null = null

async function connect(url: string): Promise<Socket> {
    const socket = io(url, { transports: ['websocket'], reconnection: false, forceNew: true })
    sockets.push(socket)
    await new Promise<void>((resolve, reject) => {
        socket.once('connect', resolve)
        socket.once('connect_error', reject)
    })
    return socket
}

function emitAck(socket: Socket, event: string, payload: unknown): Promise<CommandAck> {
    return new Promise((resolve) =>
        socket.emit(event, payload, (ack: unknown) => resolve(ack as CommandAck)),
    )
}

async function eventually<T>(read: () => T | undefined, timeoutMs = 2000): Promise<T> {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
        const value = read()
        if (value !== undefined) return value
        await new Promise((resolve) => setTimeout(resolve, 10))
    }
    throw new Error('estado esperado não chegou')
}

function lastWhere<T>(values: readonly T[], predicate: (value: T) => boolean): T | undefined {
    for (let index = values.length - 1; index >= 0; index--) {
        if (predicate(values[index])) return values[index]
    }
    return undefined
}

function collectStates(target: RoomState[]): (value: unknown) => void {
    return (value) => {
        const parsed = roomStateSchema.safeParse(value)
        if (parsed.success) target.push(parsed.data)
    }
}

function collectErrors(target: ProtocolError[]): (value: unknown) => void {
    return (value) => {
        const parsed = protocolErrorSchema.safeParse(value)
        if (parsed.success) target.push(parsed.data)
    }
}

async function startServer(): Promise<string> {
    app = await createServerApp({ logger: false })
    await app.listen(0, '127.0.0.1')
    const server = app.getHttpServer() as { address(): AddressInfo | string | null }
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('porta efêmera indisponível')
    return `http://127.0.0.1:${address.port}`
}

function accessOf(ack: CommandAck): RoomAccess {
    if (!ack.ok || !ack.access) throw new Error('ack sem acesso')
    return ack.access
}

afterEach(async () => {
    for (const socket of sockets.splice(0)) socket.disconnect()
    await app?.close()
    app = null
})

describe('servidor multiplayer e2e', () => {
    it('responde health e mantém duas conexões no mesmo estado autoritativo', async () => {
        const url = await startServer()
        await expect(fetch(`${url}/api/health`).then((response) => response.json())).resolves.toEqual({
            status: 'ok',
        })

        const host = await connect(url)
        const guest = await connect(url)
        const hostStates: RoomState[] = []
        const guestStates: RoomState[] = []
        host.on(SERVER_EVENTS.state, collectStates(hostStates))
        guest.on(SERVER_EVENTS.state, collectStates(guestStates))

        const created = accessOf(await emitAck(host, CLIENT_EVENTS.create, { modeId: 'bete', nickname: 'Ana' }))
        const joined = accessOf(
            await emitAck(guest, CLIENT_EVENTS.join, { roomCode: created.roomCode.toLowerCase(), nickname: 'Bia' }),
        )
        expect(joined.role).toBe('opponent')
        await emitAck(host, CLIENT_EVENTS.ready, { ready: true })
        await emitAck(guest, CLIENT_EVENTS.ready, { ready: true })

        const hostPlaying = await eventually(() =>
            lastWhere(hostStates, (state) => state.status === 'playing'),
        )
        const guestPlaying = await eventually(() =>
            lastWhere(guestStates, (state) => state.status === 'playing'),
        )
        expect(hostPlaying).toEqual(guestPlaying)
        expect(hostPlaying.players.player.nickname).toBe('Ana')
        expect(hostPlaying.players.opponent.nickname).toBe('Bia')
        expect(hostPlaying.nextTurn).toBe('opponent')
        expect(await emitAck(host,CLIENT_EVENTS.rematch,{ready:true,matchNumber:1})).toMatchObject({ok:false,error:{code:'NOT_READY'}})
        expect(hostPlaying.match).toMatchObject({ opponent: 'remote', turn: 'player' })

        const wrongTurn = await emitAck(guest, CLIENT_EVENTS.shot, {
            seq: 1,
            velocity: { x: 300, y: 0 },
        })
        expect(wrongTurn).toMatchObject({ ok: false, error: { code: 'NOT_YOUR_TURN' } })

        expect(await emitAck(host, CLIENT_EVENTS.shot, { seq: 1, velocity: { x: 300, y: 0 } })).toEqual({
            ok: true,
        })
        const duplicate = await emitAck(host, CLIENT_EVENTS.shot, {
            seq: 1,
            velocity: { x: 300, y: 0 },
        })
        expect(duplicate).toMatchObject({ ok: false, error: { code: 'DUPLICATE_COMMAND' } })

        const announced = await eventually(() =>
            lastWhere(hostStates, (state) => state.intent?.competitor === 'player'),
        )
        expect(announced.version).toBeGreaterThan(hostPlaying.version)
        const rolling = await eventually(() =>
            lastWhere(hostStates, (state) => state.match?.phase === 'rolling'),
        )
        expect(rolling.intent).toBeNull()
        await eventually(() =>
            lastWhere(guestStates, (state) => state.version === rolling.version),
        )
    })

    it('retoma o papel do convidado após uma queda curta', async () => {
        const url = await startServer()
        const host = await connect(url)
        const guest = await connect(url)
        const states: RoomState[] = []
        host.on(SERVER_EVENTS.state, collectStates(states))
        const created = accessOf(await emitAck(host, CLIENT_EVENTS.create, { modeId: 'hole' }))
        const joined = accessOf(
            await emitAck(guest, CLIENT_EVENTS.join, { roomCode: created.roomCode }),
        )
        await emitAck(host, CLIENT_EVENTS.ready, { ready: true })
        await emitAck(guest, CLIENT_EVENTS.ready, { ready: true })
        await eventually(() => lastWhere(states, (state) => state.status === 'playing'))

        guest.disconnect()
        await eventually(() => lastWhere(states, (state) => state.status === 'paused'))
        const returned = await connect(url)
        const resumed = await emitAck(returned, CLIENT_EVENTS.resume, {
            roomCode: created.roomCode,
            resumeToken: joined.resumeToken,
        })
        expect(accessOf(resumed).role).toBe('opponent')
        const resumedState = await eventually(() =>
            lastWhere(
                states,
                (state) => state.status === 'playing' && state.players.opponent.connected,
            ),
        )
        expect(resumedState.reconnectDeadlineMs).toBeNull()
    })

    it('rejeita mídia com erro estável sem devolver stack ou conteúdo', async () => {
        const url = await startServer()
        const client = await connect(url)
        const errors: ProtocolError[] = []
        client.on(SERVER_EVENTS.error, collectErrors(errors))
        const ack = await emitAck(client, CLIENT_EVENTS.create, {
            modeId: 'bete',
            frame: 'data:image/png;base64,SEGREDO',
        })
        expect(ack).toEqual({
            ok: false,
            error: { code: 'INVALID_PAYLOAD', message: 'Comando inválido.' },
        })
        expect(JSON.stringify({ ack, errors })).not.toContain('SEGREDO')
        expect(JSON.stringify({ ack, errors })).not.toMatch(/stack|landmarks|data:image/i)
    })

    it('desconecta somente quem excede 8 KiB e continua aceitando outra sala', async () => {
        const url = await startServer()
        const offender = await connect(url)
        const disconnected = new Promise<void>((resolve) =>
            offender.once('disconnect', () => resolve()),
        )
        offender.emit(CLIENT_EVENTS.create, {
            modeId: 'bete',
            padding: 'x'.repeat(MAX_SOCKET_PAYLOAD_BYTES * 2),
        })
        await disconnected

        const healthy = await connect(url)
        const ack = await emitAck(healthy, CLIENT_EVENTS.create, { modeId: 'triangle' })
        expect(ack).toMatchObject({ ok: true, access: { role: 'player' } })
    })
})
