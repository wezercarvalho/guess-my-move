import { describe, expect, it } from 'vitest'

import { type Body } from '../src/physics.js'
import { createMatchSession } from '../src/match/session.js'
import { DEFAULT_HOLE_CONFIG, createHoleMode } from '../src/modes/hole/index.js'
import { DEFAULT_TRIANGLE_CONFIG, createTriangleMode } from '../src/modes/triangle/index.js'

const still = { nextShot: () => null }

describe('placar da rodada na sessão', () => {
    it('Triângulo: expõe o nome da contagem e começa zerada', () => {
        const session = createMatchSession({
            modeId: 'triangle',
            mode: createTriangleMode(),
            opponent: 'bot',
            bot: still,
        })
        const snap = session.snapshot()
        expect(snap.scoreLabel).toBe('Capturas')
        expect(snap.roundYield).toEqual({ player: 0, opponent: 0 })
    })

    it('Triângulo: conta as capturas de cada competidor na rodada e zera na rodada seguinte', () => {
        const { circleCenter: c, circleRadius, radius } = DEFAULT_TRIANGLE_CONFIG
        const body = (x: number, y: number): Body => ({
            pos: { x, y },
            vel: { x: 0, y: 0 },
            radius,
        })
        // Uma bolinha já fora do círculo e uma dentro: o primeiro tiro captura uma.
        const mode = createTriangleMode({
            roundsPerMatch: 2,
            shotLimitBot: 1,
            formation: () => [body(c.x + circleRadius + radius + 5, c.y), body(c.x, c.y)],
        })
        const session = createMatchSession({
            modeId: 'triangle',
            mode,
            opponent: 'bot',
            bot: { nextShot: () => ({ x: 0, y: 0 }) },
        })
        session.shooter()
        session.firePlayerShot({ x: 0, y: 0 })
        session.advance(16)
        expect(session.snapshot().roundYield).toEqual({ player: 1, opponent: 0 })
        // O bot atira em seguida e não captura nada: o placar do jogador se mantém.
        session.advance(16)
        session.advance(16)
        const mid = session.snapshot()
        expect(mid.roundYield.player).toBe(1)
        expect(mid.roundYield.opponent).toBe(0)
        // Ao fechar a rodada e abrir a seguinte, a contagem da rodada zera.
        for (let i = 0; i < 20 && session.snapshot().phase !== 'round-over'; i++) {
            if (session.snapshot().phase === 'player-turn') session.firePlayerShot({ x: 0, y: 0 })
            session.advance(16)
        }
        expect(session.snapshot().phase).toBe('round-over')
        session.beginNextRound()
        expect(session.snapshot().roundYield).toEqual({ player: 0, opponent: 0 })
        expect(session.yieldOf('player')).toBe(1)
    })

    it('Cova: o nome da contagem é Covas', () => {
        const session = createMatchSession({
            modeId: 'hole',
            mode: createHoleMode(),
            opponent: 'target',
            bot: still,
        })
        expect(session.snapshot().scoreLabel).toBe('Covas')
    })
})

describe('Cova contra o bot: a bolinha de quem não está na vez continua visível', () => {
    const cfg = DEFAULT_HOLE_CONFIG
    const ball = (x: number, y: number): Body => ({
        pos: { x, y },
        vel: { x: 0, y: 0 },
        radius: cfg.marbleRadius,
    })

    it('não mostra a do outro antes de ele jogar', () => {
        const mode = createHoleMode()
        mode.buildRound(0, 'bot')
        expect(mode.describe?.('player', 'bot').resting).toBeUndefined()
    })

    it('mostra onde o outro parou, com o dono, depois que ele atirou', () => {
        const mode = createHoleMode()
        mode.buildRound(0, 'bot')
        mode.prepareShot?.([ball(0, 0)], 'opponent', 'bot')
        mode.evaluate({
            field: [ball(200, 250)],
            contactsInRound: [],
            competitor: 'opponent',
            shotsSpent: 1,
            opponent: 'bot',
        })
        const resting = mode.describe?.('player', 'bot').resting
        expect(resting).toEqual([{ pos: { x: 200, y: 250 }, radius: cfg.marbleRadius, owner: 'opponent' }])
        // Visto da vez do bot, a parada é a do jogador (ainda não jogou): nada a mostrar.
        expect(mode.describe?.('opponent', 'bot').resting).toBeUndefined()
    })

    it('contra a meta nunca mostra bolinha do outro', () => {
        const mode = createHoleMode()
        mode.buildRound(0, 'target')
        mode.prepareShot?.([ball(0, 0)], 'opponent', 'target')
        mode.evaluate({
            field: [ball(200, 250)],
            contactsInRound: [],
            competitor: 'opponent',
            shotsSpent: 1,
            opponent: 'target',
        })
        expect(mode.describe?.('player', 'target').resting).toBeUndefined()
    })
})
