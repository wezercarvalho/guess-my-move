import { type City, type CityRoad } from '@guess-my-move/swing'
import { describe, expect, it } from 'vitest'

import santaMariaFile from '../../public/swing/santa-maria.json?raw'
import { findStreetCorners, plateArrowAngle, rowOrder } from './streetSigns.js'

const cityOf = (roads: readonly CityRoad[]): City => ({
    version: 1,
    name: 'Teste',
    attribution: 'teste',
    bounds: { minX: -200, maxX: 200, minZ: -200, maxZ: 200 },
    buildings: [],
    roads,
})

/** Rua de norte a sul (ao longo de Z) em x = 0. */
const avenida = (name?: string, width = 10): CityRoad => ({
    width,
    ...(name === undefined ? {} : { name }),
    line: [0, -100, 0, 100],
})
/** Rua de oeste a leste (ao longo de X) em z = 0. */
const travessa = (name?: string, width = 10): CityRoad => ({
    width,
    ...(name === undefined ? {} : { name }),
    line: [-100, 0, 100, 0],
})

describe('findStreetCorners', () => {
    it('cria uma esquina onde duas ruas de nomes diferentes se cruzam', () => {
        const corners = findStreetCorners(cityOf([avenida('Rua A'), travessa('Rua B')]))
        expect(corners).toHaveLength(1)
        const [corner] = corners
        expect(corner?.x).toBeCloseTo(0)
        expect(corner?.z).toBeCloseTo(0)
        expect(corner?.streets.map((street) => street.name).sort()).toEqual(['Rua A', 'Rua B'])
        for (const street of corner?.streets ?? []) {
            expect(Math.hypot(street.dx, street.dz)).toBeCloseTo(1)
        }
    })

    it('guarda a direção de cada rua no cruzamento', () => {
        const [corner] = findStreetCorners(cityOf([avenida('Rua A'), travessa('Rua B')]))
        const a = corner?.streets.find((street) => street.name === 'Rua A')
        const b = corner?.streets.find((street) => street.name === 'Rua B')
        expect(Math.abs(a?.dz ?? 0)).toBeCloseTo(1)
        expect(Math.abs(b?.dx ?? 0)).toBeCloseTo(1)
    })

    it('ignora vias sem nome e o cruzamento de uma rua com ela mesma', () => {
        expect(findStreetCorners(cityOf([avenida('Rua A'), travessa()]))).toEqual([])
        expect(findStreetCorners(cityOf([avenida('Rua A'), travessa('Rua A')]))).toEqual([])
        expect(findStreetCorners(cityOf([avenida('Rua A'), travessa('   ')]))).toEqual([])
    })

    it('cruza ruas que se encontram numa ponta (T) como uma esquina só', () => {
        const rua: CityRoad = { width: 10, name: 'Rua T', line: [0, 0, 80, 0] }
        const corners = findStreetCorners(cityOf([avenida('Rua A'), rua]))
        expect(corners).toHaveLength(1)
    })

    it('junta vias partidas no mesmo nó numa única esquina', () => {
        const roads: CityRoad[] = [
            { width: 10, name: 'Rua A', line: [0, -100, 0, 0] },
            { width: 10, name: 'Rua A', line: [0, 0, 0, 100] },
            { width: 10, name: 'Rua B', line: [-100, 0, 0, 0] },
            { width: 10, name: 'Rua B', line: [0, 0, 100, 0] },
        ]
        expect(findStreetCorners(cityOf(roads))).toHaveLength(1)
    })

    it('não faz esquina entre ruas de nomes diferentes que seguem na mesma direção', () => {
        const roads: CityRoad[] = [
            { width: 10, name: 'Rua X', line: [0, -100, 0, 0] },
            { width: 10, name: 'Rua Y', line: [0, 0, 0, 100] },
        ]
        expect(findStreetCorners(cityOf(roads))).toEqual([])
    })

    it('com três ruas no mesmo ponto, mostra as duas mais largas que não são paralelas', () => {
        const diagonal: CityRoad = { width: 6, name: 'Rua C', line: [-70, -70, 70, 70] }
        const [corner] = findStreetCorners(cityOf([avenida('Rua A', 14), travessa('Rua B', 10), diagonal]))
        expect(corner?.streets.map((street) => street.name)).toEqual(['Rua A', 'Rua B'])
    })

    it('mantém cruzamentos distantes como esquinas separadas', () => {
        const outra: CityRoad = { width: 10, name: 'Rua D', line: [-100, 60, 100, 60] }
        expect(findStreetCorners(cityOf([avenida('Rua A'), travessa('Rua B'), outra]))).toHaveLength(2)
    })

    it('põe o poste ao lado do cruzamento, deslocado pela meia largura da outra rua mais a margem', () => {
        const [corner] = findStreetCorners(cityOf([avenida('Rua A'), travessa('Rua B')]))
        expect(Math.abs(corner?.post.x ?? 0)).toBeCloseTo(7)
        expect(Math.abs(corner?.post.z ?? 0)).toBeCloseTo(7)
    })

    it('escolhe o canto livre e cai no centro quando nenhum está livre', () => {
        const city = cityOf([avenida('Rua A'), travessa('Rua B')])
        const [livre] = findStreetCorners(city, (x, z) => x < 0 && z < 0)
        expect(livre?.post.x).toBeCloseTo(-7)
        expect(livre?.post.z).toBeCloseTo(-7)
        const [centro] = findStreetCorners(city, () => false)
        expect(centro?.post).toEqual({ x: 0, z: 0 })
    })

    it('não cria esquinas em um mapa sem nomes', () => {
        expect(findStreetCorners(cityOf([avenida(), travessa()]))).toEqual([])
    })
})

describe('plateArrowAngle', () => {
    it('rua que segue para a frente aponta para cima; a que cruza, para o lado', () => {
        expect(plateArrowAngle(0, -1, 0)).toBeCloseTo(Math.PI / 2)
        expect(plateArrowAngle(1, 0, 0)).toBeCloseTo(0)
    })

    it('é a mesma seta para os dois sentidos, já que a rua é de duas mãos', () => {
        expect(plateArrowAngle(0, 1, 0)).toBeCloseTo(Math.PI / 2)
        expect(plateArrowAngle(-1, 0, 0)).toBeCloseTo(0)
    })

    it('gira com a câmera: olhando para +X, a rua ao longo de X passa a ir para a frente', () => {
        expect(plateArrowAngle(1, 0, Math.PI / 2)).toBeCloseTo(Math.PI / 2)
        expect(plateArrowAngle(0, -1, Math.PI / 2)).toBeCloseTo(0)
    })

    it('numa diagonal a 45° inclina a seta', () => {
        const side = Math.SQRT1_2
        expect(plateArrowAngle(side, -side, 0)).toBeCloseTo(Math.PI / 4)
        expect(plateArrowAngle(side, side, 0)).toBeCloseTo(-Math.PI / 4)
    })
})

describe('rowOrder', () => {
    const norte = { name: 'Rua A', dx: 0, dz: -1, width: 10 }
    const leste = { name: 'Rua B', dx: 1, dz: 0, width: 10 }

    it('coloca em cima a rua mais alinhada com a frente da câmera', () => {
        expect(rowOrder(norte, leste, 0)).toEqual([norte, leste])
        expect(rowOrder(leste, norte, 0)).toEqual([norte, leste])
        expect(rowOrder(norte, leste, Math.PI / 2)).toEqual([leste, norte])
    })

    it('mantém a ordem dada quando as duas estão igualmente alinhadas', () => {
        expect(rowOrder(norte, leste, Math.PI / 4)).toEqual([norte, leste])
    })
})

describe('Santa Maria (arquivo real)', () => {
    it('tem ruas nomeadas e esquinas com dois nomes diferentes', () => {
        const city = JSON.parse(santaMariaFile) as City
        const named = city.roads.filter((road) => (road.name ?? '').trim() !== '')
        expect(named.length).toBeGreaterThanOrEqual(20)
        const corners = findStreetCorners(city)
        expect(corners.length).toBeGreaterThanOrEqual(10)
        for (const corner of corners) {
            expect(corner.streets[0].name).not.toBe(corner.streets[1].name)
        }
    })
})
