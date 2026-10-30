// Confere `public/swing/cities.json` e todos os arquivos City v1 apontados por ele.
// O catálogo é a lista única de mapas disponíveis no jogo; caminhos externos são recusados.
import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const publicRoot = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
const catalogFile = join(publicRoot, 'swing', 'cities.json')
const catalog = JSON.parse(readFileSync(catalogFile, 'utf8'))
const localPath = /^swing\/[a-z0-9]+(?:-[a-z0-9]+)*\.json$/
const cities = catalog.maps.map((map) => ({
    map,
    file: join(publicRoot, map.file),
    city: JSON.parse(readFileSync(join(publicRoot, map.file), 'utf8')),
}))

describe('catálogo de cidades (cities.json)', () => {
    it('é v1, tem Midtown e Paulista, sem ids duplicados', () => {
        assert.equal(catalog.version, 1)
        assert.deepEqual(catalog.maps.map((map) => map.id), ['midtown', 'paulista'])
        assert.equal(new Set(catalog.maps.map((map) => map.id)).size, catalog.maps.length)
    })

    it('aponta somente para JSON local dentro de swing/', () => {
        for (const map of catalog.maps) {
            assert.match(map.file, localPath)
            assert.ok(Number.isFinite(map.spawnHeight) && map.spawnHeight >= 20 && map.spawnHeight <= 150)
            assert.ok(!map.file.includes('..'))
            assert.ok(!map.file.includes('://'))
        }
    })
})

for (const { map, file, city } of cities) {
    describe(`dados da cidade (${map.id})`, () => {
        it('é City v1 com nome e atribuição coerentes', () => {
            assert.equal(city.version, 1)
            assert.equal(city.name, map.name)
            assert.equal(city.attribution, map.attribution)
            assert.match(city.attribution, /OpenStreetMap \(ODbL\)/)
        })

        it('tem prédios e vias suficientes para uma área jogável', () => {
            assert.ok(city.buildings.length >= 300, `prédios: ${city.buildings.length}`)
            assert.ok(city.roads.length >= 100, `vias: ${city.roads.length}`)
        })

        it('tem alturas entre 4 e 500 m', () => {
            for (const building of city.buildings) {
                assert.ok(building.height >= 4 && building.height <= 500, `altura fora da faixa: ${building.height}`)
            }
        })

        it('todo anel tem ao menos 3 pontos e número par de coordenadas', () => {
            for (const building of city.buildings) {
                assert.equal(building.ring.length % 2, 0, 'anel com número ímpar de coordenadas')
                assert.ok(building.ring.length >= 6, `anel com menos de 3 pontos: ${building.ring.length}`)
            }
        })

        it('toda via tem número par de coordenadas e ao menos 2 pontos', () => {
            for (const road of city.roads) {
                assert.equal(road.line.length % 2, 0, 'via com número ímpar de coordenadas')
                assert.ok(road.line.length >= 4, `via com menos de 2 pontos: ${road.line.length}`)
                assert.ok(road.width > 0, 'via sem largura')
            }
        })

        it('tudo cabe dentro dos bounds declarados', () => {
            const { minX, maxX, minZ, maxZ } = city.bounds
            const check = (flat, label) => {
                for (let i = 0; i < flat.length; i += 2) {
                    const x = flat[i]
                    const z = flat[i + 1]
                    assert.ok(x >= minX && x <= maxX, `${label}: x ${x} fora de [${minX}, ${maxX}]`)
                    assert.ok(z >= minZ && z <= maxZ, `${label}: z ${z} fora de [${minZ}, ${maxZ}]`)
                }
            }
            for (const building of city.buildings) check(building.ring, 'prédio')
            for (const road of city.roads) check(road.line, 'via')
        })

        it('ocupa menos de 1,5 MB em disco', () => {
            const bytes = statSync(file).size
            assert.ok(bytes < 1.5 * 1024 * 1024, `tamanho: ${bytes} bytes`)
        })
    })
}
