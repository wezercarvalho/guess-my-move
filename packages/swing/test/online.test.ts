import { describe, expect, it } from 'vitest'
import {
    createOnlineTrainingCity,
    swingCommandSchema,
    swingCreateSchema,
    swingJoinSchema,
    swingRoomStateSchema,
} from '../src/online.js'

describe('cooperative protocol', () => {
    it('normalizes names and codes and rejects private or authoritative fields', () => {
        expect(
            swingJoinSchema.parse({ roomCode: ' abc123 ', nickname: ' Ana ' }),
        ).toEqual({ roomCode: 'ABC123', nickname: 'Ana' })
        expect(
            swingCreateSchema.safeParse({
                cityId: '../../private',
                nickname: 'Ana',
            }).success,
        ).toBe(false)
        for (const input of [
            { held: {}, yawRate: 2, pitchRate: 0 },
            { held: {}, yawRate: 0, pitchRate: 0, frame: 'camera' },
            {
                held: {},
                yawRate: 0,
                pitchRate: 0,
                position: { x: 0, y: 0, z: 0 },
            },
        ])
            expect(
                swingCommandSchema.safeParse({ round: 1, seq: 1, input })
                    .success,
            ).toBe(false)
        expect(
            swingRoomStateSchema.safeParse({ resumeToken: 'secret' }).success,
        ).toBe(false)
    })
    it('generates deterministic training geometry without shared mutable instances', () => {
        const first = createOnlineTrainingCity(),
            second = createOnlineTrainingCity()
        expect(first).toEqual(second)
        expect(first.buildings).not.toBe(second.buildings)
        expect(first.buildings.length).toBeGreaterThan(20)
    })
})
