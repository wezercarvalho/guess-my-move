import { describe, expect, it } from 'vitest'

import {
    acenarCard,
    evaluateOscillation,
    type HandSample,
} from '../src/index.js'

const criterion = acenarCard.evaluation.criterion

/** Gera uma série triangular entre `low` e `high` graus. */
function zigzag(options: {
    startMs: number
    stepMs: number
    count: number
    low: number
    high: number
    period: number
}): HandSample[] {
    const { startMs, stepMs, count, low, high, period } = options
    return Array.from({ length: count }, (_, i) => {
        const phase = (i % period) / period
        const tri = phase < 0.5 ? phase * 2 : 2 - phase * 2
        return { t: startMs + i * stepMs, angleDeg: low + (high - low) * tri }
    })
}

describe('evaluateOscillation', () => {
    it('reconhece oscilações largas e repetidas dentro da janela', () => {
        // 3 ciclos de 8 amostras a 100 ms: 6 inversões em 2,4 s.
        const samples = zigzag({ startMs: 0, stepMs: 100, count: 24, low: -30, high: 30, period: 8 })
        const verdict = evaluateOscillation(criterion, samples, 2300)
        expect(verdict.recognized).toBe(true)
        expect(verdict.reversals).toBeGreaterThanOrEqual(3)
        expect(verdict.windowSamples).toBe(24)
    })

    it('não reconhece com menos amostras que o mínimo', () => {
        const samples = zigzag({ startMs: 0, stepMs: 100, count: 4, low: -30, high: 30, period: 2 })
        const verdict = evaluateOscillation(criterion, samples, 400)
        expect(verdict.windowSamples).toBe(4)
        expect(verdict.recognized).toBe(false)
    })

    it('ignora variações menores que a amplitude (histerese)', () => {
        const samples = zigzag({ startMs: 0, stepMs: 100, count: 24, low: -5, high: 5, period: 4 })
        const verdict = evaluateOscillation(criterion, samples, 2300)
        expect(verdict.reversals).toBe(0)
        expect(verdict.recognized).toBe(false)
    })

    it('não reconhece uma única inclinação sem volta', () => {
        const samples = Array.from({ length: 20 }, (_, i) => ({ t: i * 100, angleDeg: i * 5 }))
        const verdict = evaluateOscillation(criterion, samples, 1900)
        expect(verdict.reversals).toBe(0)
        expect(verdict.recognized).toBe(false)
    })

    it('considera só as amostras da janela terminada no instante atual', () => {
        const old = zigzag({ startMs: 0, stepMs: 100, count: 24, low: -30, high: 30, period: 8 })
        const flat = Array.from({ length: 30 }, (_, i) => ({ t: 5000 + i * 100, angleDeg: 0 }))
        const verdict = evaluateOscillation(criterion, [...old, ...flat], 7900)
        expect(verdict.recognized).toBe(false)
        expect(verdict.reversals).toBe(0)
        expect(verdict.windowSamples).toBe(25)
    })

    it('exclui amostras posteriores ao instante atual e a fronteira antiga da janela', () => {
        const samples: HandSample[] = [
            { t: 0, angleDeg: 0 },
            { t: 2500, angleDeg: 10 },
            { t: 3000, angleDeg: 20 },
        ]
        // Janela (nowMs - 2500, nowMs]: a amostra em t=0 sai e a de t=3000 ainda não entrou.
        const verdict = evaluateOscillation(criterion, samples, 2500)
        expect(verdict.windowSamples).toBe(1)
    })

    it('tolera lacunas desde que haja amostras suficientes', () => {
        const dense = zigzag({ startMs: 0, stepMs: 100, count: 24, low: -30, high: 30, period: 8 })
        const gapped = dense.filter((_, i) => i % 2 === 0 || i < 4)
        const verdict = evaluateOscillation(criterion, gapped, 2300)
        expect(verdict.windowSamples).toBe(gapped.length)
        expect(verdict.recognized).toBe(true)
    })

    it('devolve veredito vazio para uma série vazia', () => {
        expect(evaluateOscillation(criterion, [], 1000)).toEqual({
            recognized: false,
            reversals: 0,
            windowSamples: 0,
        })
    })

    it('respeita os parâmetros do critério', () => {
        const strict = { ...criterion, minReversals: 20 }
        const samples = zigzag({ startMs: 0, stepMs: 100, count: 24, low: -30, high: 30, period: 8 })
        expect(evaluateOscillation(strict, samples, 2300).recognized).toBe(false)
        const wide = { ...criterion, amplitudeDeg: 100 }
        expect(evaluateOscillation(wide, samples, 2300).reversals).toBe(0)
    })
})
