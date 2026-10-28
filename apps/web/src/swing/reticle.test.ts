import { describe, expect, it } from 'vitest'

import { reticlePlacement } from './reticle.js'

describe('reticlePlacement', () => {
    it('alvo dentro do quadro: fica no ponto, sem seta', () => {
        const place = reticlePlacement({ x: 0.25, y: 0.4, behind: false }, 800, 400)
        expect(place.inside).toBe(true)
        expect(place.x).toBeCloseTo(200)
        expect(place.y).toBeCloseTo(160)
    })

    it('alvo acima do quadro: vai para a borda de cima, apontando para cima', () => {
        const place = reticlePlacement({ x: 0.5, y: -0.6, behind: false }, 800, 400, 20)
        expect(place.inside).toBe(false)
        expect(place.y).toBeCloseTo(20)
        expect(place.x).toBeCloseTo(400)
        expect(place.angle).toBeCloseTo(-Math.PI / 2)
    })

    it('alvo à direita e acima: fica na borda, na direção dele', () => {
        const place = reticlePlacement({ x: 1.8, y: -0.2, behind: false }, 800, 400, 20)
        expect(place.inside).toBe(false)
        expect(place.x).toBeLessThanOrEqual(780)
        expect(place.x).toBeGreaterThan(600)
        expect(place.y).toBeGreaterThanOrEqual(20)
        expect(place.y).toBeLessThan(200)
    })

    it('alvo atrás da câmera nunca conta como dentro do quadro', () => {
        const place = reticlePlacement({ x: 0.5, y: 0.5, behind: true }, 800, 400, 20)
        expect(place.inside).toBe(false)
        expect(place.x).toBeGreaterThanOrEqual(20)
        expect(place.x).toBeLessThanOrEqual(780)
        expect(place.y).toBeGreaterThanOrEqual(20)
        expect(place.y).toBeLessThanOrEqual(380)
    })

    it('a posição nunca sai do retângulo com a margem', () => {
        for (const x of [-5, -0.5, 0.5, 1.5, 9]) {
            for (const y of [-5, -0.5, 0.5, 1.5, 9]) {
                const place = reticlePlacement({ x, y, behind: false }, 640, 360, 24)
                expect(place.x).toBeGreaterThanOrEqual(24 - 1e-6)
                expect(place.x).toBeLessThanOrEqual(616 + 1e-6)
                expect(place.y).toBeGreaterThanOrEqual(24 - 1e-6)
                expect(place.y).toBeLessThanOrEqual(336 + 1e-6)
            }
        }
    })
})
