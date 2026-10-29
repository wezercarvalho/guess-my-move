import { describe, expect, it } from 'vitest'

import { type City } from '@guess-my-move/swing'

import { WINDOW_HEIGHT, buildRoofs, buildWalls } from './cityGeometry.js'

const city: City = {
    version: 1,
    name: 'teste',
    attribution: 'teste',
    bounds: { minX: -50, maxX: 50, minZ: -50, maxZ: 50 },
    buildings: [{ height: 30, ring: [0, 0, 10, 0, 10, 10, 0, 10] }],
    roads: [],
}

describe('buildWalls', () => {
    it('faz um quadrilátero por aresta, com quatro vértices e dois triângulos cada', () => {
        const walls = buildWalls(city)
        expect(walls.positions.length / 3).toBe(16)
        expect(walls.indices.length).toBe(24)
        expect(walls.uvs.length / 2).toBe(16)
        expect(walls.colors.length / 3).toBe(16)
    })

    it('vai do chão ao telhado e conta janelas pela altura', () => {
        const walls = buildWalls(city)
        const ys = Array.from({ length: 16 }, (_, i) => walls.positions[i * 3 + 1] ?? 0)
        expect(Math.min(...ys)).toBe(0)
        expect(Math.max(...ys)).toBe(30)
        const vs = Array.from({ length: 16 }, (_, i) => walls.uvs[i * 2 + 1] ?? 0)
        expect(Math.max(...vs)).toBeCloseTo(30 / WINDOW_HEIGHT)
    })

    it('acumula o comprimento do perímetro na coordenada u', () => {
        const walls = buildWalls(city)
        const us = Array.from({ length: 16 }, (_, i) => walls.uvs[i * 2] ?? 0)
        // Quatro paredes de 10 m: o maior u cobre 40 m de perímetro.
        expect(Math.max(...us)).toBeGreaterThan(Math.min(...us))
    })

    it('mantém as cores entre 0 e 1 e escurece a base em relação ao topo', () => {
        const walls = buildWalls(city)
        for (const value of walls.colors) {
            expect(value).toBeGreaterThanOrEqual(0)
            expect(value).toBeLessThanOrEqual(1)
        }
        // Dois primeiros vértices da primeira parede estão no chão; os dois seguintes, no topo.
        expect(walls.colors[0] ?? 0).toBeLessThan(walls.colors[6] ?? 0)
    })

    it('todo índice aponta para um vértice existente', () => {
        const walls = buildWalls(city)
        for (const index of walls.indices) expect(index).toBeLessThan(16)
    })
})

describe('buildRoofs', () => {
    it('triangula a pegada na altura do prédio', () => {
        const roofs = buildRoofs(city)
        expect(roofs.positions.length / 3).toBe(4)
        expect(roofs.indices.length).toBe(6)
        for (let i = 0; i < 4; i++) expect(roofs.positions[i * 3 + 1]).toBe(30)
    })

    it('não gera nada para uma cidade sem prédios', () => {
        const empty = buildRoofs({ ...city, buildings: [] })
        expect(empty.positions.length).toBe(0)
        expect(empty.indices.length).toBe(0)
    })
})
