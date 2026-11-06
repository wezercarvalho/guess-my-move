import { describe, expect, it } from 'vitest'
import { createMatchSession, modes, type ModeId } from '@guess-my-move/marbles'
import { projectMatch, projectPlayers } from '../src/multiplayer/public-room.js'
import { RoomService } from '../src/multiplayer/room.service.js'

describe('projeção pública pura de bolinhas', () => {
    it.each(['bete', 'triangle', 'hole'] as const)(
        'clona %s sem efeitos ou campos privados',
        (modeId) => {
            const mode = modes.find((entry) => entry.id === modeId)!
            const session = createMatchSession({
                modeId,
                mode: mode.create(),
                opponent: 'remote',
            })
            session.shooter()
            const snapshot = session.snapshot(),
                before = structuredClone(snapshot)
            const projected = projectMatch(modeId, snapshot)
            expect(projectMatch(modeId, snapshot)).toEqual(projected)
            projected.field[0].pos.x += 999
            projected.shotsLeft.player = 999
            expect(snapshot).toEqual(before)
            expect(projectMatch(modeId, snapshot).field).toEqual(before.field)
            const slots = {
                player: {
                    socketId: 'private-socket',
                    nickname: 'Ana',
                    ready: true,
                    rematchReady: false,
                    token: 'secret-token',
                },
                opponent: {
                    socketId: null,
                    nickname: 'Bia',
                    ready: false,
                    rematchReady: true,
                    token: 'other-secret',
                },
            }
            const players = projectPlayers(slots)
            expect(players.player).toEqual({
                connected: true,
                nickname: 'Ana',
                ready: true,
                rematchReady: false,
            })
            expect(JSON.stringify(players)).not.toMatch(
                /secret|private-socket|token/,
            )
        },
    )
    it.each(['bete', 'triangle', 'hole'] as readonly ModeId[])(
        'mantém a bolinha preparada antes de publicar %s',
        (modeId) => {
            const service = new RoomService()
            const { access } = service.create('one', { modeId })
            service.join('two', { roomCode: access.roomCode })
            service.setReady('one', { ready: true })
            const state = service.setReady('two', { ready: true })
            const entry = modes.find((mode) => mode.id === modeId)!,
                session = createMatchSession({
                    modeId,
                    mode: entry.create(),
                    opponent: 'remote',
                })
            session.shooter()
            expect(state.match?.field).toEqual(session.snapshot().field)
            expect(service.state(access.roomCode)).toEqual(state)
        },
    )
})
