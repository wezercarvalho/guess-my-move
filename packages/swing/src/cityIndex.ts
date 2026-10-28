import { type City } from './city.js'
import { type Vec3, normalize } from './vec.js'

/** Onde um raio acertou: parede lateral ou telhado. */
export interface RayHit {
    point: Vec3
    distance: number
    /** Normal unitária da superfície, voltada para quem lançou o raio. */
    normal: Vec3
    kind: 'wall' | 'roof'
}

/** Resultado de empurrar uma esfera para fora dos prédios. */
export interface Contact {
    /** Nova posição do centro da esfera, já fora dos prédios. */
    position: Vec3
    normal: Vec3
    /** `wall` quando algum prédio empurrou de lado; `roof` quando só empurrou para cima. */
    kind: 'wall' | 'roof'
}

export interface CityIndex {
    readonly city: City
    raycast(origin: Vec3, direction: Vec3, maxDistance: number): RayHit | null
    /** Altura do telhado sob o ponto `x, z`, ou 0 quando não há prédio. */
    supportHeight(x: number, z: number): number
    /** Empurra a esfera para fora dos prédios; `null` quando ela está livre. */
    resolve(center: Vec3, radius: number): Contact | null
    /** Distância horizontal até o prédio mais próximo (0 dentro dele), limitada a `maxSearch`. */
    clearance(x: number, z: number, maxSearch?: number): number
}

interface Prepared {
    height: number
    ring: Float64Array
    minX: number
    maxX: number
    minZ: number
    maxZ: number
}

const CELL = 32
const key = (cx: number, cz: number) => (cx + 4096) * 8192 + (cz + 4096)
const cellOf = (value: number) => Math.floor(value / CELL)

function prepare(height: number, ring: readonly number[]): Prepared {
    const points = Float64Array.from(ring)
    let minX = Infinity
    let maxX = -Infinity
    let minZ = Infinity
    let maxZ = -Infinity
    for (let i = 0; i < points.length; i += 2) {
        const x = points[i] ?? 0
        const z = points[i + 1] ?? 0
        minX = Math.min(minX, x)
        maxX = Math.max(maxX, x)
        minZ = Math.min(minZ, z)
        maxZ = Math.max(maxZ, z)
    }
    return { height, ring: points, minX, maxX, minZ, maxZ }
}

/** Ponto dentro do polígono (regra par-ímpar). */
function inside(ring: Float64Array, x: number, z: number): boolean {
    let result = false
    const n = ring.length / 2
    for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = ring[i * 2] ?? 0
        const zi = ring[i * 2 + 1] ?? 0
        const xj = ring[j * 2] ?? 0
        const zj = ring[j * 2 + 1] ?? 0
        if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) result = !result
    }
    return result
}

interface Nearest {
    distance: number
    x: number
    z: number
}

/** Ponto da borda mais próximo de `x, z`. */
function nearestOnEdges(ring: Float64Array, x: number, z: number): Nearest {
    let best: Nearest = { distance: Infinity, x: 0, z: 0 }
    const n = ring.length / 2
    for (let i = 0, j = n - 1; i < n; j = i++) {
        const ax = ring[j * 2] ?? 0
        const az = ring[j * 2 + 1] ?? 0
        const ex = (ring[i * 2] ?? 0) - ax
        const ez = (ring[i * 2 + 1] ?? 0) - az
        const lengthSquared = ex * ex + ez * ez
        const t =
            lengthSquared === 0
                ? 0
                : Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / lengthSquared))
        const px = ax + ex * t
        const pz = az + ez * t
        const distance = Math.hypot(x - px, z - pz)
        if (distance < best.distance) best = { distance, x: px, z: pz }
    }
    return best
}

function rayBuilding(b: Prepared, o: Vec3, d: Vec3, maxDistance: number): RayHit | null {
    let bestT = maxDistance
    let hit: RayHit | null = null
    const n = b.ring.length / 2
    for (let i = 0, j = n - 1; i < n; j = i++) {
        const ax = b.ring[j * 2] ?? 0
        const az = b.ring[j * 2 + 1] ?? 0
        const ex = (b.ring[i * 2] ?? 0) - ax
        const ez = (b.ring[i * 2 + 1] ?? 0) - az
        const denominator = d.x * ez - d.z * ex
        if (Math.abs(denominator) < 1e-9) continue
        const wx = ax - o.x
        const wz = az - o.z
        const t = (wx * ez - wz * ex) / denominator
        const s = (wx * d.z - wz * d.x) / denominator
        if (t <= 1e-6 || t >= bestT || s < 0 || s > 1) continue
        const y = o.y + d.y * t
        if (y < 0 || y > b.height) continue
        const size = Math.hypot(ex, ez)
        let nx = ez / size
        let nz = -ex / size
        if (nx * d.x + nz * d.z > 0) {
            nx = -nx
            nz = -nz
        }
        bestT = t
        hit = {
            point: { x: o.x + d.x * t, y, z: o.z + d.z * t },
            distance: t,
            normal: { x: nx, y: 0, z: nz },
            kind: 'wall',
        }
    }
    if (d.y < 0 && o.y > b.height) {
        const t = (b.height - o.y) / d.y
        if (t < bestT) {
            const x = o.x + d.x * t
            const z = o.z + d.z * t
            if (inside(b.ring, x, z)) {
                hit = {
                    point: { x, y: b.height, z },
                    distance: t,
                    normal: { x: 0, y: 1, z: 0 },
                    kind: 'roof',
                }
            }
        }
    }
    return hit
}

/** Índice espacial dos prédios (grade de 32 m) com raycast, apoio e colisão por esfera. */
export function createCityIndex(city: City): CityIndex {
    const buildings = city.buildings.map((b) => prepare(b.height, b.ring))
    const grid = new Map<number, number[]>()
    buildings.forEach((b, id) => {
        for (let cx = cellOf(b.minX); cx <= cellOf(b.maxX); cx++) {
            for (let cz = cellOf(b.minZ); cz <= cellOf(b.maxZ); cz++) {
                const cell = grid.get(key(cx, cz))
                if (cell) cell.push(id)
                else grid.set(key(cx, cz), [id])
            }
        }
    })

    /** Prédios cujas células tocam a caixa `[minX, maxX] x [minZ, maxZ]`. */
    function near(minX: number, maxX: number, minZ: number, maxZ: number): Prepared[] {
        const ids = new Set<number>()
        for (let cx = cellOf(minX); cx <= cellOf(maxX); cx++) {
            for (let cz = cellOf(minZ); cz <= cellOf(maxZ); cz++) {
                for (const id of grid.get(key(cx, cz)) ?? []) ids.add(id)
            }
        }
        return [...ids].map((id) => buildings[id]).filter((b): b is Prepared => b !== undefined)
    }

    return {
        city,
        raycast(origin, direction, maxDistance) {
            const d = normalize(direction)
            const endX = origin.x + d.x * maxDistance
            const endZ = origin.z + d.z * maxDistance
            let best: RayHit | null = null
            for (const b of near(
                Math.min(origin.x, endX),
                Math.max(origin.x, endX),
                Math.min(origin.z, endZ),
                Math.max(origin.z, endZ),
            )) {
                const hit = rayBuilding(b, origin, d, best?.distance ?? maxDistance)
                if (hit) best = hit
            }
            return best
        },

        supportHeight(x, z) {
            let top = 0
            for (const b of near(x, x, z, z)) {
                if (b.height > top && inside(b.ring, x, z)) top = b.height
            }
            return top
        },

        resolve(center, radius) {
            let position = { ...center }
            let normal: Vec3 | null = null
            let kind: Contact['kind'] = 'roof'
            for (const b of near(
                center.x - radius,
                center.x + radius,
                center.z - radius,
                center.z + radius,
            )) {
                if (position.y - radius >= b.height) continue
                if (
                    position.x < b.minX - radius ||
                    position.x > b.maxX + radius ||
                    position.z < b.minZ - radius ||
                    position.z > b.maxZ + radius
                )
                    continue
                const isInside = inside(b.ring, position.x, position.z)
                const edge = nearestOnEdges(b.ring, position.x, position.z)
                if (!isInside && edge.distance >= radius) continue
                const sideDepth = isInside ? edge.distance + radius : radius - edge.distance
                const topDepth = b.height + radius - position.y
                if (position.y >= b.height || (isInside && topDepth <= sideDepth)) {
                    position = { ...position, y: b.height + radius }
                    normal = { x: 0, y: 1, z: 0 }
                    continue
                }
                const awayX = isInside ? edge.x - position.x : position.x - edge.x
                const awayZ = isInside ? edge.z - position.z : position.z - edge.z
                const size = Math.hypot(awayX, awayZ)
                if (size === 0) {
                    position = { ...position, y: b.height + radius }
                    normal = { x: 0, y: 1, z: 0 }
                    continue
                }
                const nx = awayX / size
                const nz = awayZ / size
                position = { x: edge.x + nx * radius, y: position.y, z: edge.z + nz * radius }
                normal = { x: nx, y: 0, z: nz }
                kind = 'wall'
            }
            return normal ? { position, normal, kind } : null
        },

        clearance(x, z, maxSearch = 40) {
            let best = maxSearch
            for (const b of near(x - maxSearch, x + maxSearch, z - maxSearch, z + maxSearch)) {
                if (inside(b.ring, x, z)) return 0
                best = Math.min(best, nearestOnEdges(b.ring, x, z).distance)
            }
            return best
        },
    }
}
