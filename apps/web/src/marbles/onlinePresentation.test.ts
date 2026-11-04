import { describe, expect, it } from 'vitest'
import {
    createMatchSession,
    modes,
    wireMatchSnapshotSchema,
    type RoomState,
} from '@guess-my-move/marbles'
import { onlineTurn, onlineWaiting, playerLabel } from './onlinePresentation.js'
const { playerShotsLeft: _legacy, ...wire } = createMatchSession({
    modeId: 'bete',
    mode: modes[0].create(),
    opponent: 'remote',
}).snapshot()
const match = wireMatchSnapshotSchema.parse(wire)
const room: RoomState = {
    roomCode: 'ABCDEF',
    modeId: 'bete',
    status: 'playing',
    version: 1,
    matchNumber: 1,
    nextTurn: 'opponent',
    players: {
        player: { connected: true, ready: true, nickname: 'Ana' },
        opponent: { connected: true, ready: true, nickname: 'Bia' },
    },
    match,
    intent: null,
    reconnectDeadlineMs: null,
}
describe('feedback nominal da partida online', () => {
    it('distingue papel local, vez atual e sequência condicional', () => {
        expect(playerLabel(room, 'opponent', 'opponent')).toBe('Bia (Você)')
        expect(onlineTurn(room, 'player')).toEqual({
            now: 'Sua vez · Ana (Você)',
            next: 'Na sequência: Bia, se a rodada continuar.',
        })
        expect(onlineTurn(room, 'opponent').now).toBe('Vez de Ana')
    })
    it('não pede gesto durante intenção ou rolagem', () => {
        expect(
            onlineTurn(
                {
                    ...room,
                    intent: {
                        competitor: 'player',
                        velocity: { x: 150, y: 0 },
                    },
                },
                'player',
            ).now,
        ).toMatch(/confirmado/)
        expect(
            onlineTurn(
                { ...room, match: { ...match, phase: 'rolling' } },
                'player',
            ).now,
        ).toMatch(/em movimento/)
    })
    it('prioriza pausa e identifica quem falta reconectar', () => {
        const paused = {
            ...room,
            status: 'paused' as const,
            players: {
                ...room.players,
                opponent: { ...room.players.opponent, connected: false },
            },
        }
        expect(onlineTurn(paused, 'player').now).toBe('Partida pausada')
        expect(onlineWaiting(paused, 'player')).toMatch(/Bia reconectar/)
    })
    it('mostra quem abre a próxima rodada e não inventa vez após o fim', () => {
        expect(
            onlineTurn(
                { ...room, match: { ...match, phase: 'round-over' } },
                'player',
            ).next,
        ).toBe('Próxima rodada: Bia')
        expect(
            onlineTurn(
                {
                    ...room,
                    status: 'finished',
                    match: { ...match, phase: 'match-over' },
                    nextTurn: null,
                },
                'player',
            ).now,
        ).toBe('Partida encerrada')
    })
})
