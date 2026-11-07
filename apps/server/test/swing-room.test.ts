import { describe, expect, it } from 'vitest'
import {
    createSwingWorld,
    swingRoomStateSchema,
    type SwingWorld,
    type Vec3,
} from '@guess-my-move/swing'
import { SwingRoomService } from '../src/swing/swing-room.service.js'
import { loadSwingCity } from '../src/swing/city-catalog.js'

function harness() {
    let now = 0
    let code = 0
    const rooms = new SwingRoomService({
        now: () => now,
        code: () => `ABC${String(++code).padStart(3, '0')}`,
    })
    const access = rooms.create('one', { cityId: 'aurora', nickname: 'Ana' })
    const second = rooms.join('two', {
        roomCode: access.roomCode,
        nickname: 'Bia',
    })
    const snapshot = () => rooms.snapshot(access.roomCode)!
    const start = () => {
        rooms.ready('one', true)
        rooms.ready('two', true)
    }
    return {
        rooms,
        access,
        second,
        snapshot,
        start,
        time: (value: number) => {
            now = value
        },
    }
}

describe('authoritative cooperative rooms', () => {
    it('waits for both players, rejects third player, publishes no credentials and advances on the server', () => {
        const h = harness()
        expect(() =>
            h.rooms.join('three', {
                roomCode: h.access.roomCode,
                nickname: 'Cris',
            }),
        ).toThrow('duas pessoas')
        h.rooms.ready('one', true)
        expect(h.snapshot().status).toBe('waiting')
        h.rooms.ready('two', true)
        expect(h.snapshot().status).toBe('playing')
        const position = h.snapshot().players[0].state.position
        h.rooms.input('one', {
            round: 1,
            seq: 0,
            input: { held: { center: true }, yawRate: 0, pitchRate: 0 },
        })
        h.rooms.advance(100)
        expect(h.snapshot().players[0].state.position).not.toEqual(position)
        expect(swingRoomStateSchema.safeParse(h.snapshot()).success).toBe(true)
        expect(JSON.stringify(h.snapshot())).not.toContain(h.access.resumeToken)
        expect(h.snapshot().objectives.length).toBeGreaterThanOrEqual(3)
    })
    it('rejects stale sequences and rounds; applies head delta only once and neutralizes old controls', () => {
        const h = harness()
        h.start()
        const before = h.snapshot().players[0].state.yaw
        const command = {
            round: 1,
            seq: 1,
            input: {
                held: {},
                yawRate: 0,
                pitchRate: 0,
                lookDelta: { yaw: 0.2, pitch: 0.1 },
            },
        }
        h.rooms.input('one', command)
        h.rooms.advance(100)
        expect(h.snapshot().players[0].state.yaw).toBeCloseTo(before + 0.2)
        expect(() => h.rooms.input('one', command)).toThrow('já foi processado')
        expect(() =>
            h.rooms.input('one', { ...command, seq: 2, round: 2 }),
        ).toThrow('outra partida')
        h.rooms.input('one', {
            round: 1,
            seq: 2,
            input: { held: {}, yawRate: 1, pitchRate: 0 },
        })
        h.time(400)
        h.rooms.advance(100)
        expect(h.snapshot().players[0].state.yaw).toBeCloseTo(before + 0.2)
    })
    it('reserves disconnected slots, pauses and resumes using the private credential', () => {
        const h = harness()
        h.start()
        h.rooms.disconnect('one')
        expect(h.snapshot().status).toBe('paused')
        const tick = h.snapshot().tick
        h.rooms.advance(100)
        expect(h.snapshot().tick).toBe(tick)
        expect(() =>
            h.rooms.resume('other', {
                roomCode: h.access.roomCode,
                resumeToken: 'wrong',
            }),
        ).toThrow('retomar')
        h.time(59_999)
        h.rooms.resume('other', {
            roomCode: h.access.roomCode,
            resumeToken: h.access.resumeToken,
        })
        expect(h.snapshot().status).toBe('playing')
        h.rooms.disconnect('other')
        h.time(120_000)
        expect(h.rooms.expire()).toBe(1)
        expect(h.rooms.activeRooms).toBe(0)
    })
    it('clears membership on expiry and allows explicit departure and a replacement without new room', () => {
        const h = harness()
        h.start()
        h.rooms.leave('one')
        expect(h.snapshot().status).toBe('waiting')
        expect(h.snapshot().round).toBe(2)
        h.rooms.join('three', { roomCode: h.access.roomCode, nickname: 'Cris' })
        h.rooms.ready('two', true)
        h.rooms.ready('three', true)
        expect(h.snapshot().status).toBe('playing')
        h.time(900_001)
        expect(h.rooms.expire()).toBe(1)
        expect(h.rooms.roomCode('two')).toBeNull()
    })
    it('collects shared objectives exactly once and requires both votes for a same-room rematch', () => {
        let target: Vec3 | null = null
        const rooms = new SwingRoomService({
            world: (city) => {
                const real = createSwingWorld(city.index, city.config)
                return {
                    ...real,
                    step(input, dt) {
                        const event = real.step(input, dt)
                        if (target) Object.assign(real.state.position, target)
                        return event
                    },
                } satisfies SwingWorld
            },
        })
        const access = rooms.create('one', {
            cityId: 'aurora',
            nickname: 'Ana',
        })
        rooms.join('two', { roomCode: access.roomCode, nickname: 'Bia' })
        rooms.ready('one', true)
        rooms.ready('two', true)
        const original = rooms.snapshot(access.roomCode)!
        for (const objective of original.objectives) {
            target = objective.position
            rooms.advance(100)
        }
        const complete = rooms.snapshot(access.roomCode)!
        expect(complete.status).toBe('finished')
        expect(
            complete.objectives.every(
                (objective) => objective.collectedBy === access.playerId,
            ),
        ).toBe(true)
        rooms.rematch('one', 1)
        expect(rooms.snapshot(access.roomCode)!.round).toBe(1)
        rooms.rematch('two', 1)
        const rematch = rooms.snapshot(access.roomCode)!
        expect(rematch.status).toBe('playing')
        expect(rematch.round).toBe(2)
        expect(
            rematch.objectives.every(
                (objective) => objective.collectedBy === null,
            ),
        ).toBe(true)
        expect(rematch.players.map((player) => player.id)).toEqual(
            original.players.map((player) => player.id),
        )
        expect(() =>
            rooms.input('one', {
                round: 1,
                seq: 999,
                input: { held: {}, yawRate: 0, pitchRate: 0 },
            }),
        ).toThrow('outra partida')
    })
    it('neutral heartbeats and repeated ready values cannot extend inactivity indefinitely', () => {
        let now = 0
        const rooms = new SwingRoomService({
            now: () => now,
            idleTimeoutMs: 1000,
            waitingTimeoutMs: 1000,
        })
        const first = rooms.create('one', { cityId: 'aurora', nickname: 'Ana' })
        now = 900
        rooms.ready('one', false)
        now = 1000
        expect(rooms.expire()).toBe(1)
        expect(rooms.snapshot(first.roomCode)).toBeNull()
        const access = rooms.create('one', {
            cityId: 'aurora',
            nickname: 'Ana',
        })
        rooms.join('two', { roomCode: access.roomCode, nickname: 'Bia' })
        rooms.ready('one', true)
        rooms.ready('two', true)
        now = 1900
        rooms.input('one', {
            round: 1,
            seq: 1,
            input: {
                held: {},
                yawRate: 0,
                pitchRate: 0,
                lookActive: true,
                lookDelta: { yaw: 0, pitch: 0 },
            },
        })
        now = 2000
        expect(rooms.expire()).toBe(1)
    })
    it('preserves the entire reconnect grace even with shorter room inactivity timeouts', () => {
        let now = 0
        const rooms = new SwingRoomService({
            now: () => now,
            idleTimeoutMs: 1000,
            waitingTimeoutMs: 1000,
        })
        const access = rooms.create('one', {
            cityId: 'aurora',
            nickname: 'Ana',
        })
        rooms.disconnect('one')
        now = 59_999
        expect(rooms.expire()).toBe(0)
        expect(
            rooms.resume('replacement', {
                roomCode: access.roomCode,
                resumeToken: access.resumeToken,
            }).playerId,
        ).toBe(access.playerId)
        rooms.disconnect('replacement')
        now = 119_999
        expect(rooms.expire()).toBe(1)
    })
    it('checks the shared room budget before allocating another city or membership', () => {
        const rooms = new SwingRoomService({ canCreateRoom: () => false })
        expect(() =>
            rooms.create('one', { cityId: 'aurora', nickname: 'Ana' }),
        ).toThrow('vagas')
        expect(rooms.activeRooms).toBe(0)
        expect(rooms.roomCode('one')).toBeNull()
    })
    it('selects only known local cities and places objectives in free traversable space', () => {
        expect(() => loadSwingCity('../private')).toThrow('indisponível')
        for (const cityId of ['midtown', 'paulista', 'santa-maria']) {
            const rooms = new SwingRoomService()
            const access = rooms.create('city-player', {
                cityId,
                nickname: 'Ana',
            })
            const state = rooms.snapshot(access.roomCode)!
            expect(state.cityId).toBe(cityId)
            expect(state.objectives.length).toBeGreaterThanOrEqual(3)
            expect(swingRoomStateSchema.safeParse(state).success).toBe(true)
        }
        const h = harness()
        const city = loadSwingCity('aurora')
        for (const objective of h.snapshot().objectives)
            expect(
                city.index.clearance(
                    objective.position.x,
                    objective.position.z,
                    8,
                ),
            ).toBeGreaterThanOrEqual(8)
    })
})

it('recovers only the private access already bound to the requesting socket without renewing inactivity', () => {
    let now = 0
    const rooms = new SwingRoomService({
        now: () => now,
        waitingTimeoutMs: 1000,
    })
    const access = rooms.create('one', { cityId: 'aurora', nickname: 'Ana' })
    now = 500
    expect(rooms.recover('one')).toEqual(access)
    expect(() => rooms.recover('stranger')).toThrow()
    expect(JSON.stringify(rooms.snapshot(access.roomCode))).not.toContain(
        access.resumeToken,
    )
    now = 1000
    expect(rooms.expire()).toBe(1)
})
it('repeating resume is idempotent only for the same socket and token and does not renew activity', () => {
    let now = 0
    const rooms = new SwingRoomService({
        now: () => now,
        waitingTimeoutMs: 1000,
    })
    const access = rooms.create('one', { cityId: 'aurora', nickname: 'Ana' })
    now = 500
    expect(rooms.resume('one', access)).toEqual(access)
    expect(() => rooms.resume('other', access)).toThrow()
    expect(() =>
        rooms.resume('one', { ...access, resumeToken: 'x'.repeat(64) }),
    ).toThrow()
    now = 1000
    expect(rooms.expire()).toBe(1)
})
