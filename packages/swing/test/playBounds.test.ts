import { describe, expect, it } from 'vitest'

import { createCityIndex } from '../src/cityIndex.js'
import { DEFAULT_SWING, createSwingState, stepPlayer } from '../src/physics.js'
import { box, cityOf } from './helpers.js'

describe('área jogável', () => {
    it('é a dos prédios com uma folga, e não a das ruas mais longas', () => {
        const city = { ...cityOf(box(0, 0, 10, 10, 50)), bounds: { minX: -1000, maxX: 1000, minZ: -1000, maxZ: 1000 } }
        const { playBounds } = createCityIndex(city)
        expect(playBounds.minX).toBeGreaterThan(-300)
        expect(playBounds.maxX).toBeLessThan(300)
        expect(playBounds.minX).toBeLessThan(0)
        expect(playBounds.maxX).toBeGreaterThan(10)
    })

    it('nunca passa dos limites do mapa', () => {
        const index = createCityIndex(cityOf(box(-190, -190, 190, 190, 50)))
        expect(index.playBounds).toEqual(index.city.bounds)
    })

    it('sem prédios, vale o mapa inteiro', () => {
        const index = createCityIndex(cityOf())
        expect(index.playBounds).toEqual(index.city.bounds)
    })

    it('o jogador bate numa parede invisível na borda da área jogável', () => {
        const city = { ...cityOf(box(0, 0, 10, 10, 50)), bounds: { minX: -1000, maxX: 1000, minZ: -1000, maxZ: 1000 } }
        const index = createCityIndex(city)
        const state = createSwingState({ x: 5, y: 100, z: 5 })
        state.started = true
        state.velocity = { x: 60, y: 0, z: 0 }
        for (let i = 0; i < 120 * 20; i++) stepPlayer(index, state, 1 / 120)
        expect(state.position.x).toBeLessThanOrEqual(index.playBounds.maxX - DEFAULT_SWING.boundsMargin + 0.001)
    })
})
