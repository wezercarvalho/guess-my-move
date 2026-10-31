import { describe, expect, it } from 'vitest'

import { modes } from '../src/index.js'
import {
    CLIENT_EVENTS,
    MAX_SHOT_SPEED,
    MIN_SHOT_SPEED,
    MODE_IDS,
    SERVER_EVENTS,
    createRoomSchema,
    joinRoomSchema,
    normalizeRoomCode,
    readyRoomSchema,
    resumeRoomSchema,
    roomStateSchema,
    shotCommandSchema,
} from '../src/multiplayer/index.js'

const expectInvalid = (schema: { safeParse(value: unknown): { success: boolean } }, value: unknown) => {
    expect(schema.safeParse(value).success).toBe(false)
}

describe('protocolo multiplayer', () => {
    it('declara nomes estáveis para todos os eventos', () => {
        expect(CLIENT_EVENTS).toEqual({
            create: 'room:create',
            join: 'room:join',
            resume: 'room:resume',
            ready: 'room:ready',
            shot: 'match:shot',
            leave: 'room:leave',
        })
        expect(SERVER_EVENTS).toEqual({ state: 'room:state', error: 'protocol:error' })
        expect(modes.map(({ id }) => id)).toEqual(MODE_IDS)
    })

    it('aceita somente os três modos ao criar a sala e rejeita campos extras', () => {
        expect(createRoomSchema.parse({ modeId: 'bete' })).toEqual({ modeId: 'bete' })
        expect(createRoomSchema.parse({ modeId: 'triangle' })).toEqual({ modeId: 'triangle' })
        expect(createRoomSchema.parse({ modeId: 'hole' })).toEqual({ modeId: 'hole' })
        expectInvalid(createRoomSchema, { modeId: 'outro' })
        expectInvalid(createRoomSchema, { modeId: 'bete', frame: 'data:image/png;base64,...' })
    })

    it('normaliza o código e valida entrada, retomada e prontidão estritas', () => {
        expect(normalizeRoomCode(' ab cd 2z ')).toBe('ABCD2Z')
        expect(joinRoomSchema.parse({ roomCode: 'ABCD2Z' })).toEqual({ roomCode: 'ABCD2Z' })
        expect(resumeRoomSchema.parse({ roomCode: 'ABCD2Z', resumeToken: 'a'.repeat(32) })).toEqual({
            roomCode: 'ABCD2Z',
            resumeToken: 'a'.repeat(32),
        })
        expect(readyRoomSchema.parse({ ready: true })).toEqual({ ready: true })
        expectInvalid(joinRoomSchema, { roomCode: 'ABC01I' })
        expectInvalid(resumeRoomSchema, { roomCode: 'ABCD2Z', resumeToken: 'curto' })
        expectInvalid(readyRoomSchema, { ready: true, landmarks: [] })
    })

    it('aceita sequência crescente positiva e o intervalo jogável de velocidade', () => {
        expect(shotCommandSchema.parse({ seq: 1, velocity: { x: MIN_SHOT_SPEED, y: 0 } })).toEqual({
            seq: 1,
            velocity: { x: MIN_SHOT_SPEED, y: 0 },
        })
        expect(
            shotCommandSchema.safeParse({ seq: 2, velocity: { x: 0, y: MAX_SHOT_SPEED } }).success,
        ).toBe(true)
        expectInvalid(shotCommandSchema, { seq: 0, velocity: { x: 200, y: 0 } })
        expectInvalid(shotCommandSchema, { seq: 1, velocity: { x: MIN_SHOT_SPEED - 1, y: 0 } })
        expectInvalid(shotCommandSchema, { seq: 1, velocity: { x: MAX_SHOT_SPEED + 1, y: 0 } })
        expectInvalid(shotCommandSchema, { seq: 1, velocity: { x: Number.NaN, y: 0 } })
        expectInvalid(shotCommandSchema, { seq: 1, velocity: { x: Number.POSITIVE_INFINITY, y: 0 } })
        expectInvalid(shotCommandSchema, {
            seq: 1,
            velocity: { x: 200, y: 0 },
            video: 'bytes',
        })
    })

    it('valida estado versionado e proíbe mídia ou campos desconhecidos', () => {
        const state = {
            roomCode: 'ABCD2Z',
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
        expect(roomStateSchema.parse(state)).toEqual(state)
        expectInvalid(roomStateSchema, { ...state, frame: 'data:image/png;base64,...' })
        expectInvalid(roomStateSchema, {
            ...state,
            players: { ...state.players, player: { ...state.players.player, landmarks: [] } },
        })
    })
})
