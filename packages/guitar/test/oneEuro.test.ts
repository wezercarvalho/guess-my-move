import { describe, expect, it } from 'vitest'

import { OneEuroFilter } from '../src/index.js'

/** Gerador pseudoaleatório determinístico para o ruído dos testes. */
function noise(seed: number): () => number {
    let state = seed >>> 0
    return () => {
        state = (state * 1664525 + 1013904223) >>> 0
        return state / 0xffffffff - 0.5
    }
}

const variance = (values: readonly number[]) => {
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length
    return values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
}

describe('OneEuroFilter', () => {
    it('a primeira amostra passa sem alteração', () => {
        const filter = new OneEuroFilter({ minCutoff: 1, beta: 0.1, dCutoff: 1 })
        expect(filter.filter(0.42, 1000)).toBe(0.42)
    })

    it('um valor constante permanece constante', () => {
        const filter = new OneEuroFilter({ minCutoff: 1, beta: 0.1, dCutoff: 1 })
        let out = 0
        for (let i = 0; i < 30; i++) out = filter.filter(0.7, 1000 + i * 33)
        expect(out).toBeCloseTo(0.7, 9)
    })

    it('reduz o tremor de um valor parado', () => {
        const filter = new OneEuroFilter({ minCutoff: 1, beta: 0.1, dCutoff: 1 })
        const random = noise(7)
        const raw: number[] = []
        const smooth: number[] = []
        for (let i = 0; i < 120; i++) {
            const value = 0.5 + random() * 0.02
            raw.push(value)
            smooth.push(filter.filter(value, 1000 + i * 33))
        }
        expect(variance(smooth.slice(10))).toBeLessThan(variance(raw.slice(10)) * 0.5)
    })

    it('acompanha um movimento rápido com pouco atraso quando beta é maior', () => {
        const slow = new OneEuroFilter({ minCutoff: 1, beta: 0, dCutoff: 1 })
        const fast = new OneEuroFilter({ minCutoff: 1, beta: 2, dCutoff: 1 })
        let lastSlow = 0
        let lastFast = 0
        for (let i = 0; i < 12; i++) {
            const t = 1000 + i * 33
            const value = i * 0.05
            lastSlow = slow.filter(value, t)
            lastFast = fast.filter(value, t)
        }
        const target = 11 * 0.05
        expect(Math.abs(target - lastFast)).toBeLessThan(Math.abs(target - lastSlow))
    })

    it('ignora um tempo que não avança e reset recomeça', () => {
        const filter = new OneEuroFilter({ minCutoff: 1, beta: 0.1, dCutoff: 1 })
        filter.filter(0.2, 1000)
        expect(filter.filter(0.9, 1000)).toBe(0.2)
        filter.reset()
        expect(filter.filter(0.9, 1000)).toBe(0.9)
    })
})
