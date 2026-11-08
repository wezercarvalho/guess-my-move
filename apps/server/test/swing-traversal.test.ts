import { describe, expect, it } from 'vitest'
import { type Vec3 } from '@guess-my-move/swing'
import { loadSwingCity } from '../src/swing/city-catalog.js'
import { routeTo } from './swing-navigation.fixture.js'
import { SwingRoomService } from '../src/swing/swing-room.service.js'

describe('cooperative objective traversal using real authoritative physics', () => {
    for (const cityId of ['aurora', 'midtown', 'paulista', 'santa-maria'])
        it(`collects the route in ${cityId} using only allowed input`, () => {
            let now = 0
            const rooms = new SwingRoomService({ now: () => now })
            const access = rooms.create('one', { cityId, nickname: 'Ana' })
            rooms.join('two', { roomCode: access.roomCode, nickname: 'Bia' })
            rooms.ready('one', true)
            rooms.ready('two', true)
            let steps = 0
            let goalId = ''
            let route: Vec3[] = []
            const index = loadSwingCity(cityId).index
            while (steps < 2400) {
                const snapshot = rooms.snapshot(access.roomCode)!
                if (snapshot.status === 'finished') break
                const player = snapshot.players[0].state
                const objective = snapshot.objectives.find(
                    (entry) => entry.collectedBy === null,
                )!
                if (player.grounded && goalId !== objective.id) {
                    route = routeTo(index, player.position, objective.position)
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
                let delta =
                    Math.atan2(
                        target.x - player.position.x,
                        -(target.z - player.position.z),
                    ) - player.yaw
                delta = Math.atan2(Math.sin(delta), Math.cos(delta))
                rooms.input('one', {
                    round: 1,
                    seq: steps,
                    input: {
                        held: steps === 0 ? { center: true } : {},
                        yawRate: 0,
                        pitchRate: 0,
                        lookActive: true,
                        lookDelta: { yaw: delta, pitch: 0 },
                    },
                })
                now += 100
                rooms.advance(100)
                steps++
            }
            const snapshot = rooms.snapshot(access.roomCode)!
            expect(
                {
                    status: snapshot.status,
                    remaining: snapshot.objectives
                        .filter((entry) => !entry.collectedBy)
                        .map((entry) => entry.position),
                    position: snapshot.players[0].state.position,
                },
                JSON.stringify(snapshot),
            ).toMatchObject({ status: 'finished' })
        })
})
