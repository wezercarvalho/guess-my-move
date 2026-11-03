import { describe, expect, it } from 'vitest'

import { type Mode, createMatchSession, modes } from '../src/index.js'

const mode: Mode = {
    name: 'duelo remoto',
    helpText: 'Alterne os tiros. Vitória, empate ou derrota ao fim.',
    roundsPerMatch: 1,
    buildRound: () => [
        { pos: { x: 100, y: 100 }, vel: { x: 0, y: 0 }, radius: 14 },
    ],
    shotLimit: () => 2,
    evaluate: () => ({ yield: 0, finished: false, outcome: null }),
}

const noShot = { nextShot: () => null }

function settle(session: ReturnType<typeof createMatchSession>): void {
    let guard = 0
    while (session.snapshot().phase === 'rolling' && guard++ < 100) {
        session.advance(250)
    }
}

describe('sessão de partida para dois competidores humanos', () => {
    it('expõe fase neutra e tiros restantes de cada competidor', () => {
        const session = createMatchSession({
            modeId: 'remote-test',
            mode,
            opponent: 'remote',
            bot: noShot,
        })

        expect(session.snapshot()).toMatchObject({
            phase: 'player-turn',
            turn: 'player',
            shotsLeft: { player: 2, opponent: 2 },
        })

        expect(session.fireShot('player', { x: 100, y: 0 })).toBe(true)
        settle(session)
        expect(session.snapshot()).toMatchObject({
            phase: 'opponent-turn',
            turn: 'opponent',
            shotsLeft: { player: 1, opponent: 2 },
        })
    })

    it('aceita somente o competidor da vez e não avança a vez remota sozinho', () => {
        const session = createMatchSession({
            modeId: 'remote-test',
            mode,
            opponent: 'remote',
            bot: noShot,
        })

        expect(session.fireShot('opponent', { x: 100, y: 0 })).toBe(false)
        expect(session.fireShot('player', { x: 100, y: 0 })).toBe(true)
        settle(session)
        expect(session.snapshot().phase).toBe('opponent-turn')

        session.advance(1000)
        expect(session.snapshot().phase).toBe('opponent-turn')
        expect(session.snapshot().shotsLeft.opponent).toBe(2)

        expect(session.fireShot('opponent', { x: -100, y: 0 })).toBe(true)
        expect(session.fireShot('opponent', { x: -100, y: 0 })).toBe(false)
        settle(session)
        expect(session.snapshot()).toMatchObject({
            phase: 'player-turn',
            turn: 'player',
            shotsLeft: { player: 1, opponent: 1 },
        })
    })

    it('mantém firePlayerShot como compatibilidade para o modo local', () => {
        const session = createMatchSession({
            modeId: 'target-test',
            mode,
            opponent: 'target',
            bot: noShot,
        })

        expect(session.firePlayerShot({ x: 100, y: 0 })).toBe(true)
        expect(session.snapshot().shotsLeft.player).toBe(1)
    })
})

describe('Bete remoto: resultado real da rodada', () => {
    for (const scenario of [
        { playerHit: true, opponentHit: false, outcome: 'win' },
        { playerHit: false, opponentHit: true, outcome: 'loss' },
        { playerHit: true, opponentHit: true, outcome: 'draw' },
        { playerHit: false, opponentHit: false, outcome: 'draw' },
    ] as const) {
        it(`jogador acerta=${scenario.playerHit}, convidado acerta=${scenario.opponentHit}: ${scenario.outcome}`, () => {
            const session = createMatchSession({ modeId: 'bete', mode: modes[0].create(), opponent: 'remote' })
            for (let i = 0; i < 10; i++) {
                const snap = session.snapshot()
                if (snap.phase === 'round-over') break
                const role = snap.turn
                if (!role) throw new Error('esperava uma vez ativa')
                const hit = role === 'player' ? scenario.playerHit : scenario.opponentHit
                const field = snap.field
                const dx = field[1].pos.x - field[0].pos.x
                const dy = field[1].pos.y - field[0].pos.y
                const length = Math.hypot(dx, dy)
                session.fireShot(role, hit ? { x: 1100 * dx / length, y: 1100 * dy / length } : { x: 0, y: 150 })
                settle(session)
            }
            expect(session.snapshot()).toMatchObject({ phase: 'round-over', lastRoundOutcome: scenario.outcome, shotsLeft: { player: scenario.playerHit || scenario.opponentHit ? 4 : 0, opponent: scenario.playerHit || scenario.opponentHit ? 4 : 0 } })
        })
    }
})
