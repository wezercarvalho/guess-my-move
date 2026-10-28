import { describe, expect, it } from 'vitest'

import { createCityIndex } from '../src/cityIndex.js'
import { box, cityOf } from './helpers.js'

const tower = box(20, -5, 30, 5, 30)

describe('raycast', () => {
    it('acerta a parede de um prédio e devolve ponto, distância e normal', () => {
        const index = createCityIndex(cityOf(tower))
        const hit = index.raycast({ x: 0, y: 10, z: 0 }, { x: 1, y: 0, z: 0 }, 100)
        expect(hit).not.toBeNull()
        expect(hit?.kind).toBe('wall')
        expect(hit?.distance).toBeCloseTo(20)
        expect(hit?.point.x).toBeCloseTo(20)
        expect(hit?.normal.x).toBeCloseTo(-1)
        expect(hit?.normal.z).toBeCloseTo(0)
    })

    it('passa por cima do prédio quando o raio está acima do telhado', () => {
        const index = createCityIndex(cityOf(tower))
        expect(index.raycast({ x: 0, y: 35, z: 0 }, { x: 1, y: 0, z: 0 }, 100)).toBeNull()
    })

    it('acerta o telhado de cima para baixo', () => {
        const index = createCityIndex(cityOf(tower))
        const hit = index.raycast({ x: 25, y: 60, z: 0 }, { x: 0, y: -1, z: 0 }, 100)
        expect(hit?.kind).toBe('roof')
        expect(hit?.point.y).toBeCloseTo(30)
        expect(hit?.normal).toEqual({ x: 0, y: 1, z: 0 })
    })

    it('respeita o alcance máximo', () => {
        const index = createCityIndex(cityOf(tower))
        expect(index.raycast({ x: 0, y: 10, z: 0 }, { x: 1, y: 0, z: 0 }, 19)).toBeNull()
    })

    it('devolve o prédio mais próximo quando há vários na linha', () => {
        const index = createCityIndex(cityOf(box(60, -5, 70, 5, 30), tower))
        const hit = index.raycast({ x: 0, y: 10, z: 0 }, { x: 1, y: 0, z: 0 }, 200)
        expect(hit?.distance).toBeCloseTo(20)
    })

    it('enxerga prédios em células distantes da grade', () => {
        const index = createCityIndex(cityOf(box(150, -5, 160, 5, 30)))
        const hit = index.raycast({ x: 0, y: 10, z: 0 }, { x: 1, y: 0, z: 0 }, 200)
        expect(hit?.distance).toBeCloseTo(150)
    })
})

describe('supportHeight', () => {
    it('devolve a altura do prédio sob o ponto e 0 fora dele', () => {
        const index = createCityIndex(cityOf(tower))
        expect(index.supportHeight(25, 0)).toBe(30)
        expect(index.supportHeight(10, 0)).toBe(0)
    })
})

describe('resolve', () => {
    it('não faz nada quando a esfera está livre', () => {
        const index = createCityIndex(cityOf(tower))
        expect(index.resolve({ x: 18.5, y: 10, z: 0 }, 1.5)).toBeNull()
    })

    it('empurra para fora da parede e informa a normal', () => {
        const index = createCityIndex(cityOf(tower))
        const contact = index.resolve({ x: 19, y: 10, z: 0 }, 1.5)
        expect(contact?.kind).toBe('wall')
        expect(contact?.position.x).toBeCloseTo(18.5)
        expect(contact?.normal.x).toBeCloseTo(-1)
        expect(contact?.normal.y).toBeCloseTo(0)
    })

    it('pousa no telhado quando a esfera afunda pouco', () => {
        const index = createCityIndex(cityOf(tower))
        const contact = index.resolve({ x: 25, y: 31, z: 0 }, 1.5)
        expect(contact?.kind).toBe('roof')
        expect(contact?.position.y).toBeCloseTo(31.5)
        expect(contact?.normal).toEqual({ x: 0, y: 1, z: 0 })
    })

    it('tira a esfera de dentro do prédio', () => {
        const index = createCityIndex(cityOf(tower))
        const contact = index.resolve({ x: 21, y: 10, z: 0 }, 1.5)
        expect(contact?.kind).toBe('wall')
        expect(contact?.position.x).toBeCloseTo(18.5)
    })

    it('ignora o prédio quando a esfera está acima do telhado', () => {
        const index = createCityIndex(cityOf(tower))
        expect(index.resolve({ x: 25, y: 40, z: 0 }, 1.5)).toBeNull()
    })
})

describe('clearance', () => {
    it('mede a distância até o prédio mais próximo', () => {
        const index = createCityIndex(cityOf(tower))
        expect(index.clearance(0, 0)).toBeCloseTo(20)
        expect(index.clearance(25, 0)).toBe(0)
    })

    it('devolve o limite de busca quando não há prédio por perto', () => {
        const index = createCityIndex(cityOf(tower))
        expect(index.clearance(-150, -150, 40)).toBe(40)
    })
})
