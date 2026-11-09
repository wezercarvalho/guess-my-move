import { describe, expect, it } from 'vitest'
import { getCardById } from '@guess-my-move/core'
import { CardRoundsService } from '../src/cards/card-rounds.service.js'

function harness(maxRounds = 100) {
    let time = 0
    const service = new CardRoundsService({ now: () => time, maxRounds })
    return {
        service,
        advance(ms: number) {
            time += ms
        },
    }
}

describe('rodadas competitivas autoritativas', () => {
    it('reconhece com critério do servidor e congela pontos/tempo ao terminar', () => {
        const h = harness()
        const start = h.service.start({ cardId: 'wave-001', locale: 'en-US' })
        expect(start.round.card.public.word).toBe('Wave')
        expect(JSON.stringify(start.round)).not.toMatch(
            /evaluation|criterion|amplitudeDeg|basePoints|token/,
        )
        let result = start.round
        for (const [index, angleDeg] of [0, 60, -60, 60, -60, 60].entries()) {
            h.advance(150)
            result = h.service.observe(start.roundId, start.token, {
                seq: index + 1,
                angleDeg,
            })
        }
        expect(result.state).toBe('recognized')
        const base = getCardById('wave-001')!.evaluation.basePoints!
        expect(result.score).toBe(
            Math.round(base * (1 - result.elapsedMs / 20000)),
        )
        h.advance(1000)
        expect(
            h.service.observe(start.roundId, start.token, {
                seq: 50,
                angleDeg: null,
            }),
        ).toEqual(result)
    })
    it('tempo do servidor encerra sem mão, e cancelamento nunca concede pontos', () => {
        const h = harness()
        const start = h.service.start({ cardId: 'wave-001', locale: 'pt-BR' })
        h.advance(10000)
        expect(
            h.service.observe(start.roundId, start.token, {
                seq: 1,
                angleDeg: 60,
            }),
        ).toMatchObject({ state: 'timed_out', score: 0, elapsedMs: 10000 })
        const next = h.service.start({ cardId: 'wave-001', locale: 'pt-BR' })
        expect(h.service.cancel(next.roundId, next.token)).toMatchObject({
            state: 'user_cancelled',
            score: 0,
        })
    })
    it('recusa token, sequência repetida e rajada sem modificar resultado', () => {
        const h = harness()
        const start = h.service.start({ cardId: 'wave-001', locale: 'pt-BR' })
        expect(() =>
            h.service.observe(start.roundId, 'invalid', {
                seq: 1,
                angleDeg: 60,
            }),
        ).toThrow()
        h.advance(100)
        h.service.observe(start.roundId, start.token, { seq: 1, angleDeg: 60 })
        expect(() =>
            h.service.observe(start.roundId, start.token, {
                seq: 1,
                angleDeg: -60,
            }),
        ).toThrow()
        expect(() =>
            h.service.observe(start.roundId, start.token, {
                seq: 2,
                angleDeg: -60,
            }),
        ).toThrow()
        h.advance(100)
        expect(
            h.service.observe(start.roundId, start.token, {
                seq: 2,
                angleDeg: -60,
            }).state,
        ).toBe('detecting')
    })
    it('limita capacidade, expira mesmo sem tráfego e não aceita carta arbitrária', () => {
        const h = harness(1)
        expect(() =>
            h.service.start({ cardId: 'missing', locale: 'pt-BR' }),
        ).toThrow()
        const start = h.service.start({ cardId: 'wave-001', locale: 'pt-BR' })
        expect(() =>
            h.service.start({ cardId: 'wave-001', locale: 'pt-BR' }),
        ).toThrow()
        h.advance(40001)
        h.service.sweep()
        expect(h.service.activeRounds).toBe(0)
        expect(() =>
            h.service.observe(start.roundId, start.token, {
                seq: 1,
                angleDeg: 0,
            }),
        ).toThrow()
        expect(
            h.service.start({ cardId: 'wave-001', locale: 'pt-BR' }),
        ).toBeDefined()
    })
})
