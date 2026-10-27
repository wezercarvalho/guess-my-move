import { describe, expect, it } from 'vitest'

import { summarizeLatency } from './latency.js'

describe('summarizeLatency', () => {
    it('devolve nulos sem medições', () => {
        expect(summarizeLatency([])).toEqual({ medianMs: null, p95Ms: null })
    })

    it('calcula a mediana de uma lista ímpar e de uma par', () => {
        expect(summarizeLatency([50, 10, 30, 20, 40]).medianMs).toBe(30)
        expect(summarizeLatency([40, 10, 30, 20]).medianMs).toBe(25)
    })

    it('calcula o p95 pelo posto mais próximo', () => {
        const values = Array.from({ length: 100 }, (_, i) => i + 1)
        expect(summarizeLatency(values).p95Ms).toBe(95)
        expect(summarizeLatency([7]).p95Ms).toBe(7)
        expect(summarizeLatency([10, 20, 30, 40, 50]).p95Ms).toBe(50)
    })

    it('não altera a lista de entrada', () => {
        const values = [3, 1, 2]
        summarizeLatency(values)
        expect(values).toEqual([3, 1, 2])
    })
})
