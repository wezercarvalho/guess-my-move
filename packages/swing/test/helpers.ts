import { type City, type CityBuilding } from '../src/city.js'

/** Prédio retangular de `x0,z0` a `x1,z1`. */
export function box(x0: number, z0: number, x1: number, z1: number, height: number): CityBuilding {
    return { height, ring: [x0, z0, x1, z0, x1, z1, x0, z1] }
}

/** Cidade mínima para os testes, com limites de -200 a 200. */
export function cityOf(...buildings: CityBuilding[]): City {
    return {
        version: 1,
        name: 'teste',
        attribution: 'teste',
        bounds: { minX: -200, maxX: 200, minZ: -200, maxZ: 200 },
        buildings,
        roads: [],
    }
}
