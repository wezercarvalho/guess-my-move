// Conversor de dados do OpenStreetMap (resposta da Overpass com `out geom tags`)
// para o formato City v1 definido em `packages/swing/src/city.ts`.
//
// Projeção equirretangular em torno do centro do bbox do mundo e rotação de 29°
// para que o eixo das avenidas vire o eixo Z. Convenção do mundo: para a frente
// é -Z, x é a direita. Coordenadas em metros, arredondadas a 0,1 m.
//
// Função pura: recebe o JSON da Overpass e devolve o objeto City (mais as
// contagens de relações usadas/ignoradas, úteis para o build e para os testes).

// Bbox fixo do trecho de Midtown (mesmos valores do brief).
const BBOX = { minLat: 40.754, maxLat: 40.762, minLon: -73.99, maxLon: -73.9805 }
const LAT0 = (BBOX.minLat + BBOX.maxLat) / 2
const LON0 = (BBOX.minLon + BBOX.maxLon) / 2

// Metros por grau: equirretangular em torno de (LAT0, LON0).
const METERS_PER_DEG_LAT = 110574
const METERS_PER_DEG_LON = Math.cos((LAT0 * Math.PI) / 180) * 111320

// Rotação de 29°: o eixo das avenidas passa a correr ao longo de Z.
const ANG = (29 * Math.PI) / 180
const COS29 = Math.cos(ANG)
const SIN29 = Math.sin(ANG)

// Larguras de pista, em metros, por classe de via.
const ROAD_WIDTHS = {
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

// Arredonda a 0,1 m e normaliza o zero negativo para zero.
const round1 = (value) => {
    const rounded = Math.round(value * 10) / 10
    return rounded === 0 ? 0 : rounded
}

/** Projeta (lat, lon) para o plano local rotacionado; devolve {x, z} em metros. */
function project(lat, lon) {
    const e = (lon - LON0) * METERS_PER_DEG_LON
    const n = (lat - LAT0) * METERS_PER_DEG_LAT
    const cross = e * COS29 - n * SIN29
    const along = e * SIN29 + n * COS29
    // Mantém a precisão plena aqui; o arredondamento a 0,1 m é feito só na saída
    // (depois de testar fechamento, colinearidade e área).
    return { x: cross, z: -along }
}

/** Remove o último ponto quando ele repete o primeiro (anel fechado). */
function dropClosingPoint(points) {
    if (points.length < 2) return points
    const first = points[0]
    const last = points[points.length - 1]
    if (Math.abs(first.x - last.x) < 1e-6 && Math.abs(first.z - last.z) < 1e-6) {
        return points.slice(0, -1)
    }
    return points
}

/** Remove vértices colineares de um anel (mantém só as quinas). */
function dropCollinear(points) {
    const n = points.length
    if (n < 3) return points
    const keep = []
    for (let i = 0; i < n; i++) {
        const prev = points[(i - 1 + n) % n]
        const cur = points[i]
        const next = points[(i + 1) % n]
        const cross = (cur.x - prev.x) * (next.z - prev.z) - (cur.z - prev.z) * (next.x - prev.x)
        // `cross` é o dobro da área do triângulo prev-cur-next, em m². Acima de
        // 0,5 m² o vértice é uma quina de verdade; abaixo disso é colinear.
        if (Math.abs(cross) > 0.5) keep.push(cur)
    }
    return keep
}

/** Área do polígono (fórmula do laço), em m², a partir de pontos {x, z}. */
function polygonArea(points) {
    let area = 0
    for (let i = 0; i < points.length; i++) {
        const a = points[i]
        const b = points[(i + 1) % points.length]
        area += a.x * b.z - b.x * a.z
    }
    return Math.abs(area) / 2
}

/** Lê a altura do prédio a partir das tags, com os padrões e o mínimo do brief. */
function readHeight(tags) {
    const raw = tags?.height
    if (typeof raw === 'string') {
        // Aceita '45', '45 m', '45.5'; ignora lixo.
        const match = raw.trim().match(/^(\d+(?:\.\d+)?)\s*m?$/i)
        if (match) return Math.max(4, Number(match[1]))
    }
    const levels = tags?.['building:levels']
    if (typeof levels === 'string') {
        const match = levels.trim().match(/^(\d+(?:\.\d+)?)$/)
        if (match) return Math.max(4, Number(match[1]) * 3.3)
    }
    return 15
}

/** Converte uma geometria OSM (lista de {lat, lon}) em pontos {x, z} projetados. */
function projectGeometry(geometry) {
    return (geometry ?? []).map(({ lat, lon }) => project(lat, lon))
}

/** Transforma um anel projetado em prédio válido, ou null se deve ser descartado. */
function buildingFromRing(projected, tags) {
    const ring = dropCollinear(dropClosingPoint(projected))
    if (ring.length < 3) return null
    if (polygonArea(ring) < 20) return null
    const flat = []
    for (const point of ring) flat.push(round1(point.x), round1(point.z))
    return { height: readHeight(tags), ring: flat }
}

/** Membros outer de uma relação que são um único caminho fechado e sem buracos. */
function singleClosedOuter(relation) {
    const members = relation.members ?? []
    const outers = members.filter((m) => m.role === 'outer' && Array.isArray(m.geometry))
    const inners = members.filter((m) => m.role === 'inner' && Array.isArray(m.geometry))
    // Só um outer, nenhum inner (sem buracos), e o caminho tem de estar fechado.
    if (outers.length !== 1 || inners.length > 0) return null
    const geometry = outers[0].geometry
    if (geometry.length < 4) return null
    const first = geometry[0]
    const last = geometry[geometry.length - 1]
    if (first.lat !== last.lat || first.lon !== last.lon) return null
    return geometry
}

/**
 * Converte a resposta da Overpass no objeto City v1.
 * @param {{elements?: Array<object>}} overpassJson
 * @returns {import('../../../packages/swing/src/city.ts').City & {relationsUsed: number, relationsSkipped: number}}
 */
export function cityFromOsm(overpassJson) {
    const elements = overpassJson?.elements ?? []
    const buildings = []
    const roads = []
    let relationsUsed = 0
    let relationsSkipped = 0

    for (const element of elements) {
        const tags = element.tags ?? {}

        if (element.type === 'way' && tags.building && Array.isArray(element.geometry)) {
            const building = buildingFromRing(projectGeometry(element.geometry), tags)
            if (building) buildings.push(building)
            continue
        }

        if (element.type === 'way' && tags.highway && Array.isArray(element.geometry)) {
            const width = ROAD_WIDTHS[tags.highway]
            if (width === undefined) continue
            const points = projectGeometry(element.geometry)
            if (points.length < 2) continue
            const line = []
            for (const point of points) line.push(round1(point.x), round1(point.z))
            roads.push({ width, line })
            continue
        }

        if (element.type === 'relation' && tags.building && tags.type === 'multipolygon') {
            const geometry = singleClosedOuter(element)
            if (!geometry) {
                relationsSkipped++
                continue
            }
            const building = buildingFromRing(projectGeometry(geometry), tags)
            if (building) {
                buildings.push(building)
                relationsUsed++
            } else {
                relationsSkipped++
            }
        }
    }

    // Bounds a partir de todos os vértices de prédios e vias.
    let minX = Infinity
    let maxX = -Infinity
    let minZ = Infinity
    let maxZ = -Infinity
    const accumulate = (flat) => {
        for (let i = 0; i < flat.length; i += 2) {
            minX = Math.min(minX, flat[i])
            maxX = Math.max(maxX, flat[i])
            minZ = Math.min(minZ, flat[i + 1])
            maxZ = Math.max(maxZ, flat[i + 1])
        }
    }
    for (const building of buildings) accumulate(building.ring)
    for (const road of roads) accumulate(road.line)
    if (!Number.isFinite(minX)) {
        minX = 0
        maxX = 0
        minZ = 0
        maxZ = 0
    }

    return {
        version: 1,
        name: 'Midtown Manhattan',
        attribution: 'Dados do mapa © colaboradores do OpenStreetMap (ODbL)',
        bounds: {
            minX: round1(minX),
            maxX: round1(maxX),
            minZ: round1(minZ),
            maxZ: round1(maxZ),
        },
        buildings,
        roads,
        relationsUsed,
        relationsSkipped,
    }
}
