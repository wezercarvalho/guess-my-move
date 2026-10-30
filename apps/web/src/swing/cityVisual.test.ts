import { describe, expect, it } from 'vitest'

import { CITY_ATMOSPHERE, roadPaintLayers } from './cityVisual.js'

describe('roadPaintLayers', () => {
    it('desenha calçada, asfalto e faixa central numa via larga', () => {
        const layers = roadPaintLayers(16)
        expect(layers.map((layer) => layer.role)).toEqual(['sidewalk', 'asphalt', 'center-line'])
        expect(layers[0]?.width).toBeGreaterThan(layers[1]?.width ?? 0)
        expect(layers[2]?.dashes).toEqual([10, 8])
    })

    it('não inventa faixa central em rua estreita', () => {
        expect(roadPaintLayers(6).map((layer) => layer.role)).toEqual(['sidewalk', 'asphalt'])
    })
})

describe('atmosfera procedural', () => {
    it('define a faixa de névoa local, sem recurso externo', () => {
        expect(CITY_ATMOSPHERE.fogNear).toBeGreaterThan(0)
        expect(CITY_ATMOSPHERE.fogFar).toBeGreaterThan(CITY_ATMOSPHERE.fogNear)
        expect(JSON.stringify(CITY_ATMOSPHERE)).not.toMatch(/https?:\/\//)
    })
})
