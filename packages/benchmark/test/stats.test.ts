import { describe, expect, it } from 'vitest'

import {
    aggregate,
    type ClipOutcome,
    median,
    percentile,
    wilson,
} from '../src/stats.js'

describe('wilson', () => {
    it('devolve ponto e intervalo plausíveis', () => {
        const w = wilson(9, 10)
        expect(w.point).toBeCloseTo(0.9, 5)
        expect(w.low).toBeGreaterThan(0.5)
        expect(w.high).toBeLessThanOrEqual(1)
        expect(w.n).toBe(10)
    })

    it('trata n=0 sem dividir por zero', () => {
        expect(wilson(0, 0)).toEqual({ point: 0, low: 0, high: 0, n: 0 })
    })
})

describe('percentile e median', () => {
    it('calcula mediana e p95', () => {
        const xs = [10, 20, 30, 40, 50]
        expect(median(xs)).toBe(30)
        expect(percentile(xs, 95)).toBeCloseTo(48, 5)
    })

    it('devolve NaN para lista vazia', () => {
        expect(Number.isNaN(percentile([], 50))).toBe(true)
    })
})

function outcome(over: Partial<ClipOutcome>): ClipOutcome {
    return {
        id: 'x',
        scenario: 'P1',
        expected: 'positive',
        guess: 'acenar',
        insufficientEvidence: false,
        matchedWaving: true,
        latencyMs: 100,
        technicalFailure: false,
        ...over,
    }
}

describe('aggregate', () => {
    it('separa TP/FN/TN/FP e calcula métricas', () => {
        const outcomes: ClipOutcome[] = [
            outcome({ expected: 'positive', matchedWaving: true }),
            outcome({ expected: 'positive', matchedWaving: false }),
            outcome({ expected: 'negative', matchedWaving: false }),
            outcome({ expected: 'negative', matchedWaving: true }),
        ]
        const m = aggregate(outcomes)
        expect(m.truePositives).toBe(1)
        expect(m.falseNegatives).toBe(1)
        expect(m.trueNegatives).toBe(1)
        expect(m.falsePositives).toBe(1)
        expect(m.recall.point).toBeCloseTo(0.5, 5)
        expect(m.precision.point).toBeCloseTo(0.5, 5)
    })

    it('exclui falhas técnicas das métricas de visão', () => {
        const outcomes: ClipOutcome[] = [
            outcome({ expected: 'positive', matchedWaving: true }),
            outcome({ expected: 'positive', technicalFailure: true }),
        ]
        const m = aggregate(outcomes)
        expect(m.technicalFailures).toBe(1)
        expect(m.recall.n).toBe(1)
        expect(m.recall.point).toBe(1)
    })

    it('calcula custo médio quando informado', () => {
        const outcomes: ClipOutcome[] = [
            outcome({ costUsd: 0.001 }),
            outcome({ costUsd: 0.003 }),
        ]
        expect(aggregate(outcomes).costPerAttemptUsd).toBeCloseTo(0.002, 6)
    })

    it('omite custo quando não informado', () => {
        expect(aggregate([outcome({})]).costPerAttemptUsd).toBeUndefined()
    })
})
