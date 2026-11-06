import {
    SWING_CLIENT_EVENTS as events,
    SWING_SERVER_EVENTS,
    swingAckSchema,
    swingRoomStateSchema,
    type SwingAck,
    type SwingRoomState,
    type Vec3,
} from '@guess-my-move/swing'
import { type INestApplication } from '@nestjs/common'
import { type AddressInfo } from 'node:net'
import { io, type Socket } from 'socket.io-client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { routeTo } from './swing-navigation.fixture.js'
import { SwingRoomService } from '../src/swing/swing-room.service.js'
import { loadSwingCity } from '../src/swing/city-catalog.js'
import { createServerApp } from '../src/app.setup.js'
const sockets: Socket[] = []
let app: INestApplication | null = null
async function start(): Promise<string> {
    app = await createServerApp({ logger: false })
    await app.listen(0, '127.0.0.1')
    const address = (
        app.getHttpServer() as { address(): AddressInfo }
    ).address()
    return `http://127.0.0.1:${address.port}`
}
async function connect(url: string): Promise<Socket> {
    const socket = io(`${url}/swing`, {
        transports: ['websocket'],
        forceNew: true,
        reconnection: false,
        extraHeaders: { Origin: 'http://localhost:5173' },
    })
    sockets.push(socket)
    await new Promise<void>((resolve, reject) => {
        socket.once('connect', resolve)
        socket.once('connect_error', reject)
    })
    return socket
}
function ack(socket: Socket, event: string, data: unknown): Promise<SwingAck> {
    return new Promise((resolve, reject) =>
        socket
            .timeout(2000)
            .emit(event, data, (error: Error | null, value: unknown) => {
                if (error) reject(error)
                else resolve(swingAckSchema.parse(value))
            }),
    )
}
async function eventually(check: () => boolean): Promise<void> {
    for (let attempt = 0; attempt < 100; attempt++) {
        if (check()) return
        await new Promise((resolve) => setTimeout(resolve, 20))
    }
    throw new Error('Snapshot cooperativo esperado não chegou.')
}
afterEach(async () => {
    for (const socket of sockets.splice(0)) socket.disconnect()
    await app?.close()
    app = null
    vi.unstubAllEnvs()
})
describe('cooperative Socket.IO namespace', () => {
    it('shares city, teammates and authoritative movement; pauses and resumes in the same room', async () => {
        const url = await start(),
            one = await connect(url),
            two = await connect(url)
        let state: SwingRoomState | null = null
        const states: SwingRoomState[] = []
        two.on(SWING_SERVER_EVENTS.state, (raw: unknown) => {
            state = swingRoomStateSchema.parse(raw)
            states.push(state)
        })
        const created = await ack(one, events.create, {
            cityId: 'aurora',
            nickname: 'Ana',
        })
        if (!created.ok || !created.access) throw new Error('Acesso ausente.')
        const access = created.access
        expect(
            (
                await ack(two, events.join, {
                    roomCode: access.roomCode,
                    nickname: 'Bia',
                })
            ).ok,
        ).toBe(true)
        await eventually(() =>
            states.some((value) => value.players.length === 2),
        )
        expect(states.at(-1)!.players.map((player) => player.nickname)).toEqual(
            ['Ana', 'Bia'],
        )
        expect(JSON.stringify(states)).not.toContain(access.resumeToken)
        await ack(one, events.ready, { ready: true })
        await ack(two, events.ready, { ready: true })
        await eventually(() =>
            states.some((value) => value.status === 'playing'),
        )
        const original = states.at(-1)!.players[0].state.position
        expect(
            (
                await ack(one, events.input, {
                    round: 1,
                    seq: 1,
                    input: { held: { center: true }, yawRate: 0, pitchRate: 0 },
                })
            ).ok,
        ).toBe(true)
        await eventually(() =>
            states.some(
                (value) => value.players[0].state.position.y !== original.y,
            ),
        )
        expect(
            (
                await ack(one, events.input, {
                    round: 1,
                    seq: 1,
                    input: { held: {}, yawRate: 0, pitchRate: 0 },
                })
            ).ok,
        ).toBe(false)
        expect(
            (
                await ack(one, events.input, {
                    round: 1,
                    seq: 2,
                    input: {
                        held: {},
                        yawRate: 0,
                        pitchRate: 0,
                        landmarks: [1, 2],
                    },
                })
            ).ok,
        ).toBe(false)
        one.disconnect()
        await eventually(() => states.at(-1)?.status === 'paused')
        const reconnected = await connect(url)
        expect(
            (
                await ack(reconnected, events.resume, {
                    roomCode: access.roomCode,
                    resumeToken: access.resumeToken,
                })
            ).ok,
        ).toBe(true)
        await eventually(() => states.at(-1)?.status === 'playing')
        expect(states.at(-1)!.cityId).toBe('aurora')
        expect(states.at(-1)!.players[0].id).toBe(access.playerId)
        expect((await ack(reconnected, events.leave, {})).ok).toBe(true)
        await eventually(
            () =>
                states.at(-1)?.status === 'waiting' &&
                states.at(-1)?.players.length === 1,
        )
        expect(states.at(-1)!.round).toBe(2)
    })
    it('completes a real-physics cooperative round over two sockets and starts a bilateral rematch', async () => {
        let now = Date.now()
        const clock = vi.spyOn(Date, 'now').mockImplementation(() => now)
        try {
            const url = await start(),
                one = await connect(url),
                two = await connect(url)
            const observed: [SwingRoomState[], SwingRoomState[]] = [[], []]
            for (const [index, socket] of [one, two].entries())
                socket.on(SWING_SERVER_EVENTS.state, (raw: unknown) =>
                    observed[index].push(swingRoomStateSchema.parse(raw)),
                )
            const created = await ack(one, events.create, {
                cityId: 'aurora',
                nickname: 'Ana',
            })
            if (!created.ok || !created.access)
                throw new Error('Acesso ausente.')
            const access = created.access
            const joined = await ack(two, events.join, {
                roomCode: access.roomCode,
                nickname: 'Bia',
            })
            if (!joined.ok || !joined.access) throw new Error('Acesso ausente.')
            expect((await ack(one, events.ready, { ready: true })).ok).toBe(
                true,
            )
            expect((await ack(two, events.ready, { ready: true })).ok).toBe(
                true,
            )
            const rooms = app!.get(SwingRoomService)
            const city = loadSwingCity('aurora').index
            let goalId = '',
                route: Vec3[] = []
            // Accelerate the service clock, never the world state: every motion request
            // crosses the actual Socket.IO validation, limiter and authoritative physics.
            for (let seq = 0; seq < 2400; seq++) {
                const state = rooms.snapshot(access.roomCode)!
                if (state.status === 'finished') break
                const player = state.players[0].state
                const objective = state.objectives.find(
                    (entry) => entry.collectedBy === null,
                )!
                if (player.grounded && goalId !== objective.id) {
                    route = routeTo(city, player.position, objective.position)
                    goalId = objective.id
                }
                while (
                    route.length &&
                    Math.hypot(
                        route[0].x - player.position.x,
                        route[0].z - player.position.z,
                    ) < 1.5
                )
                    route.shift()
                const target = route[0] ?? objective.position
                const angle =
                    Math.atan2(
                        target.x - player.position.x,
                        -(target.z - player.position.z),
                    ) - player.yaw
                now += 100
                const result = await ack(one, events.input, {
                    round: 1,
                    seq,
                    input: {
                        held: seq === 0 ? { center: true } : {},
                        yawRate: 0,
                        pitchRate: 0,
                        lookActive: true,
                        lookDelta: {
                            yaw: Math.atan2(Math.sin(angle), Math.cos(angle)),
                            pitch: 0,
                        },
                    },
                })
                if (!result.ok) {
                    // The real gateway timer may collect the last objective while
                    // this final input is crossing the transport. Completion is
                    // proved below; every other rejection must still fail.
                    expect(result.error.code).toBe('invalid-state')
                    expect(rooms.snapshot(access.roomCode)?.status).toBe(
                        'finished',
                    )
                    break
                }
                rooms.advance(100)
            }
            expect(rooms.snapshot(access.roomCode)!.status).toBe('finished')
            await eventually(() =>
                observed.every(
                    (states) => states.at(-1)?.status === 'finished',
                ),
            )
            const completed = observed[0].at(-1)!
            expect(
                completed.objectives.every(
                    (objective) => objective.collectedBy !== null,
                ),
            ).toBe(true)
            expect(observed[1].at(-1)!.objectives).toEqual(completed.objectives)
            expect((await ack(one, events.rematch, { round: 1 })).ok).toBe(true)
            await eventually(() =>
                observed.every(
                    (states) => states.at(-1)?.players[0].rematchReady === true,
                ),
            )
            expect(rooms.snapshot(access.roomCode)!.status).toBe('finished')
            expect(rooms.snapshot(access.roomCode)!.round).toBe(1)
            expect((await ack(two, events.rematch, { round: 1 })).ok).toBe(true)
            await eventually(() =>
                observed.every(
                    (states) =>
                        states.at(-1)?.round === 2 &&
                        states.at(-1)?.status === 'playing',
                ),
            )
            const replay = observed[0].at(-1)!
            expect(replay.roomCode).toBe(access.roomCode)
            expect(replay.players.map((player) => player.id)).toEqual([
                access.playerId,
                joined.access.playerId,
            ])
            expect(
                replay.objectives.every(
                    (objective) => objective.collectedBy === null,
                ),
            ).toBe(true)
            expect(JSON.stringify(observed)).not.toContain(access.resumeToken)
            expect(JSON.stringify(observed)).not.toContain(
                joined.access.resumeToken,
            )
            // The original private credential still resumes the same player after rematch.
            one.disconnect()
            await eventually(() => observed[1].at(-1)?.status === 'paused')
            const replacement = await connect(url)
            const resumed = await ack(replacement, events.resume, {
                roomCode: access.roomCode,
                resumeToken: access.resumeToken,
            })
            expect(resumed).toMatchObject({
                ok: true,
                access: {
                    playerId: access.playerId,
                    roomCode: access.roomCode,
                },
            })
            await eventually(
                () =>
                    observed[1].at(-1)?.status === 'playing' &&
                    observed[1].at(-1)?.round === 2,
            )
        } finally {
            clock.mockRestore()
        }
    }, 10_000)
    it('rejects an untrusted origin when connecting directly to the swing namespace', async () => {
        const url = await start()
        const socket = io(`${url}/swing`, {
            transports: ['websocket'],
            forceNew: true,
            reconnection: false,
            extraHeaders: { Origin: 'https://untrusted.example' },
        })
        sockets.push(socket)
        await expect(
            new Promise<void>((resolve, reject) => {
                socket.once('connect', resolve)
                socket.once('connect_error', reject)
            }),
        ).rejects.toThrow()
        expect(socket.connected).toBe(false)
    })
    it('keeps malformed room attempts counted across reconnection and namespaces', async () => {
        vi.stubEnv('ROOM_ATTEMPTS_PER_MINUTE', '1')
        const url = await start()
        const first = await connect(url)
        expect(
            (
                await ack(first, events.create, {
                    cityId: 'aurora',
                    nickname: '',
                })
            ).ok,
        ).toBe(false)
        first.disconnect()
        const second = await connect(url)
        const denied = await ack(second, events.create, {
            cityId: 'aurora',
            nickname: 'Ana',
        })
        expect(denied).toMatchObject({
            ok: false,
            error: { code: 'rate-limited' },
        })
        const marbles = io(url, {
            transports: ['websocket'],
            forceNew: true,
            reconnection: false,
            extraHeaders: { Origin: 'http://localhost:5173' },
        })
        sockets.push(marbles)
        await new Promise<void>((resolve, reject) => {
            marbles.once('connect', resolve)
            marbles.once('connect_error', reject)
        })
        const result = await ack(marbles, 'room:create', {
            modeId: 'bete',
            nickname: 'Ana',
        })
        expect(result.ok).toBe(false)
        if (!result.ok) expect(result.error.code).toBe('RATE_LIMITED')
    })
    it('shares connection capacity with the marbles namespace', async () => {
        vi.stubEnv('MAX_CONNECTIONS', '1')
        const url = await start(),
            swing = await connect(url)
        expect(swing.connected).toBe(true)
        const marbles = io(url, {
            transports: ['websocket'],
            forceNew: true,
            reconnection: false,
            extraHeaders: { Origin: 'http://localhost:5173' },
        })
        sockets.push(marbles)
        await expect(
            new Promise<void>((resolve, reject) => {
                marbles.once('connect', resolve)
                marbles.once('connect_error', reject)
            }),
        ).rejects.toThrow('websocket error')
    })
})
