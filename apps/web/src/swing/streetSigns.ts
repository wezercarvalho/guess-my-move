import { type City } from '@guess-my-move/swing'

/** Uma rua numa esquina: nome, direção do eixo (vetor unitário no plano X/Z) e largura. */
export interface StreetRef {
    readonly name: string
    readonly dx: number
    readonly dz: number
    readonly width: number
}

/** Uma esquina com placa: o cruzamento, onde fica o poste e as duas ruas mostradas. */
export interface StreetCorner {
    readonly x: number
    readonly z: number
    readonly post: { readonly x: number; readonly z: number }
    readonly streets: readonly [StreetRef, StreetRef]
}

/** Cruzamentos mais próximos que isso viram uma única esquina. */
const MERGE_RADIUS = 15
/** Seno mínimo do ângulo entre as duas ruas; abaixo disso elas são tratadas como paralelas. */
const MIN_CROSS = 0.35
/** Tolerância, em metros, para duas vias que só se tocam na ponta. */
const TOUCH_TOLERANCE = 0.5
/** Distância do poste à beira da outra rua, em metros. */
const POST_MARGIN = 2

interface Segment {
    readonly x1: number
    readonly z1: number
    readonly x2: number
    readonly z2: number
}

interface NamedRoad {
    readonly name: string
    readonly width: number
    readonly segments: readonly Segment[]
    readonly minX: number
    readonly maxX: number
    readonly minZ: number
    readonly maxZ: number
}

interface Cluster {
    readonly x: number
    readonly z: number
    readonly streets: Map<string, StreetRef>
}

function namedRoads(city: City): NamedRoad[] {
    const roads: NamedRoad[] = []
    for (const road of city.roads) {
        const name = (road.name ?? '').trim()
        if (name === '' || road.line.length < 4) continue
        const segments: Segment[] = []
        let minX = Infinity
        let maxX = -Infinity
        let minZ = Infinity
        let maxZ = -Infinity
        for (let i = 0; i + 3 < road.line.length; i += 2) {
            const x1 = road.line[i] ?? 0
            const z1 = road.line[i + 1] ?? 0
            const x2 = road.line[i + 2] ?? 0
            const z2 = road.line[i + 3] ?? 0
            segments.push({ x1, z1, x2, z2 })
            minX = Math.min(minX, x1, x2)
            maxX = Math.max(maxX, x1, x2)
            minZ = Math.min(minZ, z1, z2)
            maxZ = Math.max(maxZ, z1, z2)
        }
        roads.push({ name, width: road.width, segments, minX, maxX, minZ, maxZ })
    }
    return roads
}

/** Onde dois segmentos se cruzam (ou se tocam na ponta), com a direção de cada um. */
function intersect(
    a: Segment,
    b: Segment,
): { x: number; z: number; da: [number, number]; db: [number, number] } | null {
    const ax = a.x2 - a.x1
    const az = a.z2 - a.z1
    const bx = b.x2 - b.x1
    const bz = b.z2 - b.z1
    const lengthA = Math.hypot(ax, az)
    const lengthB = Math.hypot(bx, bz)
    if (lengthA < 1e-6 || lengthB < 1e-6) return null
    const denominator = ax * bz - az * bx
    // Seno do ângulo entre os dois: paralelos não se cruzam.
    if (Math.abs(denominator) / (lengthA * lengthB) < 1e-6) return null
    const dx = b.x1 - a.x1
    const dz = b.z1 - a.z1
    const t = (dx * bz - dz * bx) / denominator
    const u = (dx * az - dz * ax) / denominator
    const toleranceA = TOUCH_TOLERANCE / lengthA
    const toleranceB = TOUCH_TOLERANCE / lengthB
    if (t < -toleranceA || t > 1 + toleranceA || u < -toleranceB || u > 1 + toleranceB) return null
    return {
        x: a.x1 + ax * t,
        z: a.z1 + az * t,
        da: [ax / lengthA, az / lengthA],
        db: [bx / lengthB, bz / lengthB],
    }
}

function addToCluster(cluster: Cluster, name: string, direction: [number, number], width: number): void {
    const known = cluster.streets.get(name)
    if (known && known.width >= width) return
    cluster.streets.set(name, { name, dx: direction[0], dz: direction[1], width })
}

/** Escolhe as duas ruas mais largas do cruzamento que não sejam paralelas. */
function pickStreets(streets: Iterable<StreetRef>): [StreetRef, StreetRef] | null {
    const sorted = [...streets].sort((p, q) => q.width - p.width || p.name.localeCompare(q.name))
    const first = sorted[0]
    if (!first) return null
    for (const other of sorted.slice(1)) {
        const cross = Math.abs(first.dx * other.dz - first.dz * other.dx)
        if (cross >= MIN_CROSS) return [first, other]
    }
    return null
}

/** O canto livre mais próximo do cruzamento, ou o centro dele quando nenhum canto está livre. */
function postFor(
    x: number,
    z: number,
    [a, b]: [StreetRef, StreetRef],
    isClear: (x: number, z: number) => boolean,
): { x: number; z: number } {
    const alongA = b.width / 2 + POST_MARGIN
    const alongB = a.width / 2 + POST_MARGIN
    for (const sa of [1, -1]) {
        for (const sb of [1, -1]) {
            const px = x + a.dx * sa * alongA + b.dx * sb * alongB
            const pz = z + a.dz * sa * alongA + b.dz * sb * alongB
            if (isClear(px, pz)) return { x: px, z: pz }
        }
    }
    return { x, z }
}

/**
 * Esquinas com placa: um ponto por cruzamento de vias com nomes diferentes. Ruas partidas no
 * mesmo nó e cruzamentos a menos de 15 m viram uma esquina só, com as duas ruas mais largas.
 * `isClear` diz se um ponto está livre de prédios, para o poste não nascer dentro de um.
 */
export function findStreetCorners(
    city: City,
    isClear: (x: number, z: number) => boolean = () => true,
): StreetCorner[] {
    const roads = namedRoads(city)
    const clusters: Cluster[] = []
    for (let i = 0; i < roads.length; i++) {
        const first = roads[i]
        if (!first) continue
        for (let j = i + 1; j < roads.length; j++) {
            const second = roads[j]
            if (!second || second.name === first.name) continue
            if (
                first.maxX < second.minX - 1 ||
                second.maxX < first.minX - 1 ||
                first.maxZ < second.minZ - 1 ||
                second.maxZ < first.minZ - 1
            ) {
                continue
            }
            for (const a of first.segments) {
                for (const b of second.segments) {
                    const hit = intersect(a, b)
                    if (!hit) continue
                    let cluster = clusters.find(
                        (candidate) => Math.hypot(candidate.x - hit.x, candidate.z - hit.z) <= MERGE_RADIUS,
                    )
                    if (!cluster) {
                        cluster = { x: hit.x, z: hit.z, streets: new Map() }
                        clusters.push(cluster)
                    }
                    addToCluster(cluster, first.name, hit.da, first.width)
                    addToCluster(cluster, second.name, hit.db, second.width)
                }
            }
        }
    }
    const corners: StreetCorner[] = []
    for (const cluster of clusters) {
        const streets = pickStreets(cluster.streets.values())
        if (!streets) continue
        corners.push({
            x: cluster.x,
            z: cluster.z,
            post: postFor(cluster.x, cluster.z, streets, isClear),
            streets,
        })
    }
    return corners
}

/**
 * Ângulo da seta de duas pontas na placa, que olha para a câmera: 0 é para o lado (a rua que
 * cruza) e meia-volta (π/2) é para cima (a rua que segue para a frente). Como a rua é de duas
 * mãos, o ângulo vale módulo π e fica em (-π/2, π/2].
 */
export function plateArrowAngle(dx: number, dz: number, yaw: number): number {
    const side = dx * Math.cos(yaw) + dz * Math.sin(yaw)
    const ahead = dx * Math.sin(yaw) - dz * Math.cos(yaw)
    let angle = Math.atan2(ahead, side)
    if (angle > Math.PI / 2 + 1e-9) angle -= Math.PI
    else if (angle <= -Math.PI / 2 + 1e-9) angle += Math.PI
    return angle
}

/** Ordem das linhas da placa: primeiro a rua mais alinhada com a frente da câmera. */
export function rowOrder(a: StreetRef, b: StreetRef, yaw: number): [StreetRef, StreetRef] {
    const forwardness = (street: StreetRef): number =>
        Math.abs(street.dx * Math.sin(yaw) - street.dz * Math.cos(yaw))
    return forwardness(b) - forwardness(a) > 1e-9 ? [b, a] : [a, b]
}
