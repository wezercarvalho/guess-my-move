import { describe, expect, it } from 'vitest'

import { createCityIndex } from '../src/cityIndex.js'
import { DEFAULT_WEB, pickAnchor } from '../src/web.js'
import { box, cityOf } from './helpers.js'

const RIGHT = Math.PI / 2
const TEN_DEGREES = (10 * Math.PI) / 180

describe('pickAnchor', () => {
    it('prende na parede à frente e acima, pelo primeiro raio que acerta', () => {
        const index = createCityIndex(cityOf(box(40, -5, 50, 5, 80)))
        const anchor = pickAnchor(index, { x: 0, y: 30, z: 0 }, RIGHT, TEN_DEGREES)
        expect(anchor).not.toBeNull()
        expect(anchor?.x).toBeCloseTo(40)
        // O primeiro raio sobe 35° acima da câmera (10°): 45° no total, então y = 30 + 40.
        expect(anchor?.y).toBeCloseTo(70, 0)
    })

    it('devolve null quando não há prédio no alcance', () => {
        const index = createCityIndex(cityOf())
        expect(pickAnchor(index, { x: 0, y: 30, z: 0 }, RIGHT, TEN_DEGREES)).toBeNull()
    })

    it('ignora o acerto que está abaixo do mínimo de subida', () => {
        const index = createCityIndex(cityOf(box(40, -5, 50, 5, 20)))
        expect(pickAnchor(index, { x: 0, y: 30, z: 0 }, RIGHT, TEN_DEGREES)).toBeNull()
    })

    it('ignora o acerto perto demais na horizontal', () => {
        const index = createCityIndex(cityOf(box(5, -5, 10, 5, 200)))
        expect(pickAnchor(index, { x: 0, y: 30, z: 0 }, RIGHT, TEN_DEGREES)).toBeNull()
    })

    it('ignora o que está além do alcance', () => {
        const x0 = DEFAULT_WEB.range + 20
        const index = createCityIndex(cityOf(box(x0, -5, x0 + 10, 5, 400)))
        expect(pickAnchor(index, { x: 0, y: 30, z: 0 }, RIGHT, TEN_DEGREES)).toBeNull()
    })

    it('cai no raio mais baixo quando os mais altos passam por cima', () => {
        // Prédio baixo e largo: só o raio de +8° (18° no total) acerta a parede abaixo do telhado.
        const index = createCityIndex(cityOf(box(60, -50, 70, 50, 50)))
        const anchor = pickAnchor(index, { x: 0, y: 30, z: 0 }, RIGHT, TEN_DEGREES)
        expect(anchor?.x).toBeCloseTo(60)
        expect(anchor?.y).toBeCloseTo(30 + 60 * Math.tan((18 * Math.PI) / 180), 0)
    })
})
