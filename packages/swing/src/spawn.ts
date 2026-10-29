import { type CityIndex } from './cityIndex.js'
import { DEFAULT_SWING, type SwingConfig } from './physics.js'
import { type Vec3 } from './vec.js'
import { pickAnchor } from './web.js'

/** Distância mínima do ponto de partida a qualquer prédio, em metros. */
const MIN_CLEARANCE = 15
const SEARCH_STEP = 10
/** Inclinação inicial da câmera, a mesma de `createSwingState`. */
const START_PITCH = (10 * Math.PI) / 180
/** A primeira teia precisa de corda longa para fazer arco: prédio alto e a pelo menos 50 m. */
const START_RISE = 30
const START_DISTANCE = 50

/**
 * Ponto de partida: procura em espiral, a partir da origem, um lugar da rua livre de prédios
 * e dentro do mapa. Prefere o primeiro de onde a teia, lançada logo ao começar, alcança um
 * prédio à frente; sem nenhum assim, usa o primeiro lugar livre. Sem achar, começa na origem.
 */
export function findSpawn(index: CityIndex, config: SwingConfig = DEFAULT_SWING): Vec3 {
    const startWeb = { ...config.web, minRise: START_RISE, minHorizontal: START_DISTANCE }
    const bounds = index.playBounds
    const reach = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ)
    let firstFree: Vec3 | null = null
    for (let radius = 0; radius <= reach; radius += SEARCH_STEP) {
        const points = radius === 0 ? 1 : Math.ceil((2 * Math.PI * radius) / SEARCH_STEP)
        for (let i = 0; i < points; i++) {
            const angle = (2 * Math.PI * i) / points
            const x = Math.cos(angle) * radius
            const z = Math.sin(angle) * radius
            const inside =
                x > bounds.minX + config.boundsMargin &&
                x < bounds.maxX - config.boundsMargin &&
                z > bounds.minZ + config.boundsMargin &&
                z < bounds.maxZ - config.boundsMargin
            if (!inside || index.clearance(x, z, MIN_CLEARANCE) < MIN_CLEARANCE) continue
            const point = { x, y: config.spawnHeight, z }
            firstFree ??= point
            if (pickAnchor(index, point, 0, START_PITCH, startWeb)) return point
        }
    }
    return firstFree ?? { x: 0, y: config.spawnHeight, z: 0 }
}
