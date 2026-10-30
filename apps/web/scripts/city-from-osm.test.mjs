// Testes do conversor do OpenStreetMap para o formato City v1.
// Fixtures sintéticas pequenas, escritas no próprio teste, com valores de
// projeção e rotação calculados à mão para fixar a matemática do conversor.
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { cityFromOsm } from './city-from-osm.mjs'

// Centro do bbox fixo do mundo (mesmos valores do conversor).
const LAT0 = (40.754 + 40.762) / 2 // 40.758
const LON0 = (-73.99 + -73.9805) / 2 // -73.98525
const COS_LAT0 = Math.cos((LAT0 * Math.PI) / 180)
const ANG = (29 * Math.PI) / 180
const COS29 = Math.cos(ANG)
const SIN29 = Math.sin(ANG)

/** Projeta um (lat, lon) do mesmo jeito que o conversor, para prever a saída. */
function project(lat, lon) {
    const e = (lon - LON0) * COS_LAT0 * 111320
    const n = (lat - LAT0) * 110574
    const cross = e * COS29 - n * SIN29
    const along = e * SIN29 + n * COS29
    const round1 = (value) => {
        const rounded = Math.round(value * 10) / 10
        return rounded === 0 ? 0 : rounded
    }
    return { x: round1(cross), z: round1(-along) }
}

/** Monta um way de prédio a partir de um anel de pares [lat, lon]. */
function buildingWay(id, latlons, tags = {}) {
    return {
        type: 'way',
        id,
        geometry: latlons.map(([lat, lon]) => ({ lat, lon })),
        tags: { building: 'yes', ...tags },
    }
}

/** Monta um way de via a partir de uma linha de pares [lat, lon]. */
function highwayWay(id, latlons, highway, tags = {}) {
    return {
        type: 'way',
        id,
        geometry: latlons.map(([lat, lon]) => ({ lat, lon })),
        tags: { highway, ...tags },
    }
}

// Um quadrado grande (~50 m de lado) perto do centro, para testes de área/altura.
// Deslocamentos em graus que rendem lados bem acima do limite de área.
const D_LAT = 0.00045 // ~49,8 m em latitude
const D_LON = 0.0006 // ~50,6 m em longitude nessa latitude
const bigSquare = (lat0, lon0) => [
    [lat0, lon0],
    [lat0 + D_LAT, lon0],
    [lat0 + D_LAT, lon0 + D_LON],
    [lat0, lon0 + D_LON],
    [lat0, lon0], // fechado: o conversor remove o ponto repetido
]

describe('cityFromOsm: metadados e estrutura', () => {
    it('devolve City v1 com nome e atribuição ODbL', () => {
        const city = cityFromOsm({ elements: [buildingWay(1, bigSquare(LAT0, LON0), { height: '30' })] })
        assert.equal(city.version, 1)
        assert.equal(city.name, 'Midtown Manhattan')
        assert.match(city.attribution, /ODbL/)
        assert.ok(Array.isArray(city.buildings))
        assert.ok(Array.isArray(city.roads))
        assert.ok(city.bounds && typeof city.bounds.minX === 'number')
    })
})

describe('cityFromOsm: projeção e rotação', () => {
    it('projeta e rotaciona cada vértice com arredondamento a 0,1 m', () => {
        const ring = bigSquare(LAT0, LON0)
        const city = cityFromOsm({ elements: [buildingWay(1, ring, { height: '30' })] })
        assert.equal(city.buildings.length, 1)
        const got = city.buildings[0].ring
        // Anel sem o ponto repetido no fim: 4 vértices distintos => 8 números.
        assert.equal(got.length, 8)
        // Confere os primeiros vértices contra a projeção calculada à mão.
        const expectedFirst = project(ring[0][0], ring[0][1])
        assert.equal(got[0], expectedFirst.x)
        assert.equal(got[1], expectedFirst.z)
        const expectedThird = project(ring[2][0], ring[2][1])
        assert.equal(got[4], expectedThird.x)
        assert.equal(got[5], expectedThird.z)
    })

    it('o ponto no centro do bbox cai perto da origem', () => {
        const centro = project(LAT0, LON0)
        assert.equal(centro.x, 0)
        assert.equal(centro.z, 0)
    })
})

describe('cityFromOsm: alturas', () => {
    const squareAt = (tags) => ({ elements: [buildingWay(1, bigSquare(LAT0, LON0), tags)] })

    it('usa a tag height numérica', () => {
        assert.equal(cityFromOsm(squareAt({ height: '45' })).buildings[0].height, 45)
    })

    it('aceita height com unidade e decimal', () => {
        assert.equal(cityFromOsm(squareAt({ height: '45 m' })).buildings[0].height, 45)
        assert.equal(cityFromOsm(squareAt({ height: '45.5' })).buildings[0].height, 45.5)
    })

    it('ignora height lixo e cai no padrão', () => {
        assert.equal(cityFromOsm(squareAt({ height: 'alto' })).buildings[0].height, 15)
    })

    it('usa building:levels x 3,3 quando não há height', () => {
        assert.equal(cityFromOsm(squareAt({ 'building:levels': '10' })).buildings[0].height, 33)
    })

    it('usa o padrão 15 m sem nenhuma pista de altura', () => {
        assert.equal(cityFromOsm(squareAt({})).buildings[0].height, 15)
    })

    it('impõe o mínimo de 4 m', () => {
        assert.equal(cityFromOsm(squareAt({ height: '1' })).buildings[0].height, 4)
        assert.equal(cityFromOsm(squareAt({ 'building:levels': '1' })).buildings[0].height, 4)
    })
})

describe('cityFromOsm: descarte de prédios', () => {
    it('descarta prédios com área menor que 20 m²', () => {
        // Triângulo minúsculo: ~0,00003 grau de lado => muito menos que 20 m².
        const tiny = [
            [LAT0, LON0],
            [LAT0 + 0.00003, LON0],
            [LAT0, LON0 + 0.00003],
            [LAT0, LON0],
        ]
        const city = cityFromOsm({ elements: [buildingWay(1, tiny, { height: '30' })] })
        assert.equal(city.buildings.length, 0)
    })

    it('descarta prédios com menos de 3 pontos', () => {
        const line = [
            [LAT0, LON0],
            [LAT0 + D_LAT, LON0],
            [LAT0, LON0], // vira 1 ponto depois de tirar o repetido
        ]
        const city = cityFromOsm({ elements: [buildingWay(1, line, { height: '30' })] })
        assert.equal(city.buildings.length, 0)
    })
})

describe('cityFromOsm: pontos colineares', () => {
    it('remove o vértice do meio de três colineares', () => {
        // Quadrado com um vértice extra no meio de uma aresta.
        const ring = [
            [LAT0, LON0],
            [LAT0 + D_LAT / 2, LON0], // colinear na aresta esquerda
            [LAT0 + D_LAT, LON0],
            [LAT0 + D_LAT, LON0 + D_LON],
            [LAT0, LON0 + D_LON],
            [LAT0, LON0],
        ]
        const city = cityFromOsm({ elements: [buildingWay(1, ring, { height: '30' })] })
        assert.equal(city.buildings.length, 1)
        // 5 vértices distintos, mas um é colinear => 4 restam => 8 números.
        assert.equal(city.buildings[0].ring.length, 8)
    })
})

describe('cityFromOsm: relações multipolygon', () => {
    const outerRing = (lat0, lon0) => [
        { lat: lat0, lon: lon0 },
        { lat: lat0 + D_LAT, lon: lon0 },
        { lat: lat0 + D_LAT, lon: lon0 + D_LON },
        { lat: lat0, lon: lon0 + D_LON },
        { lat: lat0, lon: lon0 },
    ]

    it('usa o outer que é um único caminho fechado', () => {
        const rel = {
            type: 'relation',
            id: 100,
            tags: { building: 'yes', type: 'multipolygon', height: '40' },
            members: [{ type: 'way', role: 'outer', geometry: outerRing(LAT0, LON0) }],
        }
        const city = cityFromOsm({ elements: [rel] })
        assert.equal(city.buildings.length, 1)
        assert.equal(city.buildings[0].height, 40)
        assert.equal(city.relationsUsed, 1)
        assert.equal(city.relationsSkipped, 0)
    })

    it('ignora a relação com vários outers (ou outer não fechado) e conta', () => {
        const rel = {
            type: 'relation',
            id: 101,
            tags: { building: 'yes', type: 'multipolygon', height: '40' },
            members: [
                { type: 'way', role: 'outer', geometry: outerRing(LAT0, LON0) },
                { type: 'way', role: 'outer', geometry: outerRing(LAT0 + 0.001, LON0) },
            ],
        }
        const city = cityFromOsm({ elements: [rel] })
        assert.equal(city.buildings.length, 0)
        assert.equal(city.relationsUsed, 0)
        assert.equal(city.relationsSkipped, 1)
    })

    it('ignora a relação com buraco (inner) e conta', () => {
        const rel = {
            type: 'relation',
            id: 102,
            tags: { building: 'yes', type: 'multipolygon', height: '40' },
            members: [
                { type: 'way', role: 'outer', geometry: outerRing(LAT0, LON0) },
                { type: 'way', role: 'inner', geometry: outerRing(LAT0, LON0) },
            ],
        }
        const city = cityFromOsm({ elements: [rel] })
        assert.equal(city.buildings.length, 0)
        assert.equal(city.relationsSkipped, 1)
    })
})

describe('cityFromOsm: classes de via', () => {
    const classes = {
        motorway: 18,
        trunk: 18,
        primary: 16,
        secondary: 14,
        tertiary: 12,
        residential: 10,
        unclassified: 10,
        living_street: 8,
        pedestrian: 8,
        service: 6,
    }

    it('atribui a largura correta por classe', () => {
        const line = [
            [LAT0, LON0],
            [LAT0 + D_LAT, LON0 + D_LON],
        ]
        for (const [highway, width] of Object.entries(classes)) {
            const city = cityFromOsm({ elements: [highwayWay(1, line, highway)] })
            assert.equal(city.roads.length, 1, `${highway} deveria virar 1 via`)
            assert.equal(city.roads[0].width, width, `largura de ${highway}`)
            // A linha é uma lista de pares x,z.
            assert.equal(city.roads[0].line.length % 2, 0)
            assert.equal(city.roads[0].line.length, 4)
        }
    })

    it('ignora classes de via desconhecidas', () => {
        const line = [
            [LAT0, LON0],
            [LAT0 + D_LAT, LON0],
        ]
        const city = cityFromOsm({ elements: [highwayWay(1, line, 'footway')] })
        assert.equal(city.roads.length, 0)
    })
})

describe('cityFromOsm: bounds', () => {
    it('calcula os bounds a partir de prédios e vias', () => {
        const city = cityFromOsm({
            elements: [
                buildingWay(1, bigSquare(LAT0, LON0), { height: '30' }),
                highwayWay(2, [
                    [LAT0 + 0.002, LON0],
                    [LAT0 + 0.003, LON0 + 0.001],
                ], 'primary'),
            ],
        })
        const coords = []
        for (const b of city.buildings) coords.push(b.ring)
        for (const r of city.roads) coords.push(r.line)
        let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
        for (const flat of coords) {
            for (let i = 0; i < flat.length; i += 2) {
                minX = Math.min(minX, flat[i])
                maxX = Math.max(maxX, flat[i])
                minZ = Math.min(minZ, flat[i + 1])
                maxZ = Math.max(maxZ, flat[i + 1])
            }
        }
        assert.equal(city.bounds.minX, minX)
        assert.equal(city.bounds.maxX, maxX)
        assert.equal(city.bounds.minZ, minZ)
        assert.equal(city.bounds.maxZ, maxZ)
    })
})


describe('cityFromOsm: configuração por cidade', () => {
    it('aceita nome, bbox e rotação sem alterar os defaults de Midtown', () => {
        const bbox = { minLat: -23.57, maxLat: -23.56, minLon: -46.66, maxLon: -46.65 }
        const lat0 = (bbox.minLat + bbox.maxLat) / 2
        const lon0 = (bbox.minLon + bbox.maxLon) / 2
        const city = cityFromOsm(
            { elements: [buildingWay(1, bigSquare(lat0, lon0), { height: '70' })] },
            { name: 'Avenida Paulista', bbox, rotationDeg: -46 },
        )
        assert.equal(city.name, 'Avenida Paulista')
        assert.equal(city.buildings.length, 1)
        // O primeiro ponto é o centro da projeção definida pela cidade, qualquer que seja a latitude.
        assert.equal(city.buildings[0].ring[0], 0)
        assert.equal(city.buildings[0].ring[1], 0)

        const midtown = cityFromOsm({ elements: [buildingWay(2, bigSquare(LAT0, LON0), { height: '30' })] })
        assert.equal(midtown.name, 'Midtown Manhattan')
        assert.equal(midtown.buildings[0].ring[0], 0)
        assert.equal(midtown.buildings[0].ring[1], 0)
    })

    it('rejeita bbox e rotação inválidos', () => {
        assert.throws(
            () => cityFromOsm({ elements: [] }, { bbox: { minLat: 1, maxLat: 0, minLon: 0, maxLon: 1 } }),
            /bbox/i,
        )
        assert.throws(() => cityFromOsm({ elements: [] }, { rotationDeg: Number.NaN }), /rotação/i)
    })
})
