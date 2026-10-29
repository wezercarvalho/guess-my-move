// Confere o arquivo de dados da cidade gerado em public/swing/midtown.json.
// Valida a forma do City v1, as faixas de altura, a consistência dos anéis e
// das linhas, se tudo cabe dentro dos bounds e o tamanho do arquivo.
import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const file = join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    'public',
    'swing',
    'midtown.json',
)
const city = JSON.parse(readFileSync(file, 'utf8'))

describe('dados da cidade (midtown.json)', () => {
    it('é City v1 com atribuição ODbL', () => {
        assert.equal(city.version, 1)
        assert.equal(city.name, 'Midtown Manhattan')
        assert.match(city.attribution, /ODbL/)
    })

    it('tem pelo menos 300 prédios e 100 vias', () => {
        assert.ok(city.buildings.length >= 300, `prédios: ${city.buildings.length}`)
        assert.ok(city.roads.length >= 100, `vias: ${city.roads.length}`)
    })

    it('tem alturas entre 4 e 500 m', () => {
        for (const building of city.buildings) {
            assert.ok(
                building.height >= 4 && building.height <= 500,
                `altura fora da faixa: ${building.height}`,
            )
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
