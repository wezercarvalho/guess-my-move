import { describe, expect, it, vi } from 'vitest'
import {
    createSwingState,
    type SwingRoomState,
    type SwingInput,
} from '@guess-my-move/swing'
import { OnlineSwingSession } from './onlineSession.js'
import type { SwingOnlineSnapshot } from './multiplayerClient.js'
function harness() {
    const state = createSwingState({ x: 30, y: 90, z: 0 })
    const room: SwingRoomState = {
        roomCode: 'ABC123',
        cityId: 'aurora',
        cityVersion: 1,
        round: 1,
        tick: 1,
        status: 'playing',
        players: [
            {
                id: 'one',
                nickname: 'Ana',
                connected: true,
                ready: true,
                rematchReady: false,
                state,
            },
        ],
        objectives: [],
    }
    let view: SwingOnlineSnapshot = {
        connection: 'connected',
        access: { roomCode: 'ABC123', playerId: 'one', resumeToken: 'private' },
        room,
        pending: false,
        stale: false,
        error: null,
    }
    const sendInput = vi.fn<(input: SwingInput) => void>(),
        session = new OnlineSwingSession({ getSnapshot: () => view, sendInput })
    const world = {
        state: createSwingState({ x: 0, y: 0, z: 0 }),
        advance: vi.fn(),
    }
    const input: SwingInput = { held: {}, yawRate: 0, pitchRate: 0 }
    return {
        session,
        world,
        room,
        input,
        sendInput,
        update: (patch: Partial<SwingOnlineSnapshot>) => {
            view = { ...view, ...patch }
        },
    }
}
describe('sessão online independente da câmera', () => {
    it('reconcilia e limita previsão sem mutar snapshot, com intents a 10 Hz', () => {
        const h = harness()
        h.session.advance(
            h.world,
            { ...h.input, lookDelta: { yaw: 0.1, pitch: 0 } },
            0,
            0.016,
        )
        expect(h.world.state.position.x).toBe(30)
        h.world.state.position.x = 99
        expect(h.room.players[0].state.position.x).toBe(30)
        h.session.advance(
            h.world,
            { ...h.input, lookDelta: { yaw: 0.2, pitch: 0 } },
            50,
            0.016,
        )
        h.session.advance(
            h.world,
            { ...h.input, lookDelta: { yaw: 0.3, pitch: 0 } },
            100,
            0.016,
        )
        expect(h.sendInput).toHaveBeenCalledTimes(2)
        expect(h.sendInput.mock.calls[1][0].lookDelta?.yaw).toBeCloseTo(0.5)
        const count = h.world.advance.mock.calls.length
        h.session.advance(h.world, h.input, 201, 0.016)
        expect(h.world.advance).toHaveBeenCalledTimes(count)
    })
    it.each(['disconnected', 'paused', 'stale'] as const)(
        'não envia nem prevê durante %s e descarta deltas',
        (kind) => {
            const h = harness()
            h.session.advance(h.world, h.input, 0, 0.016)
            if (kind === 'disconnected')
                h.update({ connection: 'disconnected' })
            else if (kind === 'stale') h.update({ stale: true })
            else h.update({ room: { ...h.room, status: 'paused' } })
            const calls = h.sendInput.mock.calls.length,
                steps = h.world.advance.mock.calls.length
            h.session.advance(
                h.world,
                { ...h.input, lookDelta: { yaw: 1, pitch: 1 } },
                100,
                0.016,
            )
            expect(h.sendInput).toHaveBeenCalledTimes(calls)
            expect(h.world.advance).toHaveBeenCalledTimes(steps)
            h.update({ connection: 'connected', stale: false, room: h.room })
            h.session.advance(h.world, h.input, 200, 0.016)
            expect(h.sendInput.mock.calls.at(-1)?.[0].lookDelta).toEqual({
                yaw: 0,
                pitch: 0,
            })
        },
    )
    it('nova partida e reset não reutilizam deltas nem ignoram snapshot do mundo remontado', () => {
        const h = harness(),
            round = vi.fn()
        h.session.advance(h.world, h.input, 0, 0.016)
        h.session.advance(
            h.world,
            { ...h.input, lookDelta: { yaw: 1, pitch: 1 } },
            10,
            0.016,
        )
        h.update({ room: { ...h.room, round: 2, tick: 0 } })
        h.session.advance(h.world, h.input, 20, 0.016, round)
        expect(round).toHaveBeenCalledTimes(1)
        expect(h.sendInput.mock.calls.at(-1)?.[0].lookDelta).toEqual({
            yaw: 0,
            pitch: 0,
        })
        h.session.reset()
        h.world.state.position.x = -50
        h.session.advance(h.world, h.input, 30, 0.016)
        expect(h.world.state.position.x).toBe(30)
    })
})
