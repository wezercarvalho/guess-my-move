export interface CityMap {
    readonly id: string
    readonly name: string
    readonly region: string
    readonly description: string
    /** Caminho relativo à origem do app, sempre dentro de `swing/`. */
    readonly file: string
    /** Altura inicial de jogo, calibrada à altura dos prédios desse mapa. */
    readonly spawnHeight: number
    readonly attribution: string
    readonly recommended?: boolean
}

export interface CityCatalog {
    readonly version: 1
    readonly maps: readonly CityMap[]
}

type FetchLike = (url: string) => Promise<Response>

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const LOCAL_CITY = /^swing\/[a-z0-9]+(?:-[a-z0-9]+)*\.json$/

function text(value: unknown, label: string): string {
    if (typeof value !== 'string' || value.trim() === '') throw new Error(`${label} do mapa inválido`)
    return value.trim()
}

/** Valida o catálogo antes de qualquer id virar seleção ou caminho de rede. */
export function parseCityCatalog(value: unknown): CityCatalog {
    if (!value || typeof value !== 'object') throw new Error('formato do catálogo de mapas inválido')
    const data = value as { version?: unknown; maps?: unknown }
    if (data.version !== 1) throw new Error('versão do catálogo de mapas não suportada')
    if (!Array.isArray(data.maps) || data.maps.length === 0) throw new Error('catálogo de mapas vazio ou inválido')

    const seen = new Set<string>()
    const maps = data.maps.map((raw): CityMap => {
        if (!raw || typeof raw !== 'object') throw new Error('mapa inválido no catálogo')
        const item = raw as Record<string, unknown>
        const id = text(item.id, 'id')
        if (!ID.test(id)) throw new Error(`id do mapa inválido: ${id}`)
        if (seen.has(id)) throw new Error(`id duplicado no catálogo: ${id}`)
        seen.add(id)
        const file = text(item.file, 'caminho')
        if (!LOCAL_CITY.test(file) || file.includes('..') || file.includes('://') || file.startsWith('//')) {
            throw new Error(`caminho do mapa inválido: ${file}`)
        }
        const spawnHeight = item.spawnHeight
        if (
            typeof spawnHeight !== 'number' ||
            !Number.isFinite(spawnHeight) ||
            spawnHeight < 20 ||
            spawnHeight > 150
        ) {
            throw new Error('altura inicial do mapa inválida')
        }
        const map: CityMap = {
            id,
            name: text(item.name, 'nome'),
            region: text(item.region, 'região'),
            description: text(item.description, 'descrição'),
            file,
            spawnHeight,
            attribution: text(item.attribution, 'atribuição'),
        }
        if (typeof item.recommended === 'boolean') return { ...map, recommended: item.recommended }
        return map
    })
    return { version: 1, maps }
}

export async function fetchCityCatalog(
    url: string,
    fetchImpl: FetchLike = (input) => fetch(input),
): Promise<CityCatalog> {
    const response = await fetchImpl(url)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return parseCityCatalog(await response.json())
}

/** Resolve somente ids previamente validados; id desconhecido nunca vira caminho. */
export function resolveCityMap(catalog: CityCatalog, id: string | null): CityMap | null {
    if (!id || !ID.test(id)) return null
    return catalog.maps.find((map) => map.id === id) ?? null
}

export const DEFAULT_CITY_MAP: CityMap = {
    id: 'midtown',
    name: 'Midtown Manhattan',
    region: 'Nova York, Estados Unidos',
    description: 'Torres altas e avenidas largas.',
    file: 'swing/midtown.json',
    spawnHeight: 90,
    attribution: 'Dados do mapa © colaboradores do OpenStreetMap (ODbL)',
    recommended: true,
}
