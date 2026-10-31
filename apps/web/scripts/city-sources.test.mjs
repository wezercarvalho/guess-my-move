import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { CITY_SOURCES, citySource } from './city-sources.mjs'

describe('fontes locais de cidades', () => {
    it('define Midtown, Paulista e Santa Maria com ids e saídas distintas', () => {
        assert.deepEqual(CITY_SOURCES.map((source) => source.id), ['midtown', 'paulista', 'santa-maria'])
        assert.equal(citySource('midtown').name, 'Midtown Manhattan')
        assert.equal(citySource('paulista').name, 'Avenida Paulista')
        assert.equal(citySource('santa-maria').name, 'Santa Maria')
        assert.equal(new Set(CITY_SOURCES.map((source) => source.output)).size, CITY_SOURCES.length)
    })

    it('cada fonte tem bbox ordenado, rotação finita e saída JSON segura', () => {
        for (const source of CITY_SOURCES) {
            assert.ok(source.bbox.minLat < source.bbox.maxLat)
            assert.ok(source.bbox.minLon < source.bbox.maxLon)
            assert.ok(Number.isFinite(source.rotationDeg))
            assert.match(source.output, /^[a-z0-9-]+\.json$/)
        }
    })

    it('rejeita id desconhecido', () => {
        assert.throws(() => citySource('../../rio'), /desconhecida/i)
    })
})
