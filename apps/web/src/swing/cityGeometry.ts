import { type City, type CityBuilding } from '@guess-my-move/swing'
import { ShapeUtils, Vector2 } from 'three'

/** Dados de uma malha prontos para virar `BufferGeometry`. */
export interface MeshData {
    positions: Float32Array
    colors: Float32Array
    uvs: Float32Array
    indices: Uint32Array
}

/** Largura e altura, em metros, de uma janela na textura de fachada. */
export const WINDOW_WIDTH = 3.5
export const WINDOW_HEIGHT = 3.6

/** Tons de fachada (pedra, tijolo, vidro…); o prédio escolhe um pelo índice. */
const TINTS: readonly (readonly [number, number, number])[] = [
    [0.8, 0.74, 0.66],
    [0.64, 0.6, 0.57],
    [0.55, 0.64, 0.74],
    [0.74, 0.55, 0.46],
    [0.72, 0.72, 0.75],
    [0.5, 0.53, 0.6],
]

/** Direção do sol no plano horizontal (normalizada), para sombrear as paredes. */
const SUN = { x: 0.6, z: 0.8 }

const ROOF = [0.34, 0.35, 0.38] as const

function tintOf(id: number): readonly [number, number, number] {
    return TINTS[(id * 7 + 3) % TINTS.length] ?? TINTS[0] ?? [1, 1, 1]
}

function finish(
    positions: number[],
    colors: number[],
    uvs: number[],
    indices: number[],
): MeshData {
    return {
        positions: Float32Array.from(positions),
        colors: Float32Array.from(colors),
        uvs: Float32Array.from(uvs),
        indices: Uint32Array.from(indices),
    }
}

/** Área assinada da pegada (positiva quando anti-horária no plano x, z). */
function signedArea(ring: readonly number[]): number {
    let area = 0
    const n = ring.length / 2
    for (let i = 0, j = n - 1; i < n; j = i++) {
        area += (ring[j * 2] ?? 0) * (ring[i * 2 + 1] ?? 0) - (ring[i * 2] ?? 0) * (ring[j * 2 + 1] ?? 0)
    }
    return area / 2
}

function wallsOf(building: CityBuilding, id: number, out: number[][]): void {
    const [positions, colors, uvs, indices] = out as [number[], number[], number[], number[]]
    const { ring, height } = building
    const tint = tintOf(id)
    const outward = signedArea(ring) > 0 ? 1 : -1
    const n = ring.length / 2
    let along = 0
    for (let i = 0; i < n; i++) {
        const next = (i + 1) % n
        const ax = ring[i * 2] ?? 0
        const az = ring[i * 2 + 1] ?? 0
        const bx = ring[next * 2] ?? 0
        const bz = ring[next * 2 + 1] ?? 0
        const length = Math.hypot(bx - ax, bz - az)
        if (length === 0) continue
        const nx = ((bz - az) / length) * outward
        const nz = (-(bx - ax) / length) * outward
        const shade = 0.45 + 0.55 * Math.max(0, nx * SUN.x + nz * SUN.z)
        const u0 = along / WINDOW_WIDTH
        const u1 = (along + length) / WINDOW_WIDTH
        const v1 = height / WINDOW_HEIGHT
        const base = positions.length / 3
        positions.push(ax, 0, az, bx, 0, bz, bx, height, bz, ax, height, az)
        uvs.push(u0, 0, u1, 0, u1, v1, u0, v1)
        for (const level of [0.6, 0.6, 1, 1]) {
            colors.push(tint[0] * shade * level, tint[1] * shade * level, tint[2] * shade * level)
        }
        indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
        along += length
    }
}

/** Paredes de todos os prédios: um quadrilátero por aresta, com u em metros de perímetro. */
export function buildWalls(city: City): MeshData {
    const out: number[][] = [[], [], [], []]
    city.buildings.forEach((building, id) => {
        wallsOf(building, id, out)
    })
    return finish(out[0] ?? [], out[1] ?? [], out[2] ?? [], out[3] ?? [])
}

/** Telhados: a pegada triangulada na altura do prédio, em cor lisa. */
export function buildRoofs(city: City): MeshData {
    const positions: number[] = []
    const colors: number[] = []
    const uvs: number[] = []
    const indices: number[] = []
    for (const { ring, height } of city.buildings) {
        const contour: Vector2[] = []
        for (let i = 0; i < ring.length; i += 2) contour.push(new Vector2(ring[i], ring[i + 1]))
        const base = positions.length / 3
        for (const point of contour) {
            positions.push(point.x, height, point.y)
            colors.push(...ROOF)
            uvs.push(0, 0)
        }
        for (const triangle of ShapeUtils.triangulateShape(contour, [])) {
            indices.push(base + (triangle[0] ?? 0), base + (triangle[1] ?? 0), base + (triangle[2] ?? 0))
        }
    }
    return finish(positions, colors, uvs, indices)
}
