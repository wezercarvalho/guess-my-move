// Baixa um trecho pequeno da Overpass e grava City v1 em `public/swing/`.
// Uso: `node scripts/build-city.mjs <midtown|paulista>`.
// Rede só neste build manual; o jogo serve o JSON local da própria origem.
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { cityFromOsm } from './city-from-osm.mjs'
import { citySource } from './city-sources.mjs'

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
const USER_AGENT = 'guess-my-move-city-builder/0.2 (github.com/wezercarvalho/guess-my-move)'
const TIMEOUT_MS = 120_000
const ATTRIBUTION = 'Dados do mapa © colaboradores do OpenStreetMap (ODbL)'
const HIGHWAY_CLASSES =
    'motorway|trunk|primary|secondary|tertiary|residential|unclassified|living_street|pedestrian|service'

function bboxText({ minLat, minLon, maxLat, maxLon }) {
    return `${minLat},${minLon},${maxLat},${maxLon}`
}

function queryFor(source) {
    const bbox = bboxText(source.bbox)
    return `[out:json][timeout:120];
(
  way[building](${bbox});
  relation[building][type=multipolygon](${bbox});
  way[highway~"^(${HIGHWAY_CLASSES})$"](${bbox});
);
out geom tags;`
}

async function fetchOverpass(source, fetchImpl = fetch) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
        const response = await fetchImpl(OVERPASS_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': USER_AGENT,
            },
            body: new URLSearchParams({ data: queryFor(source) }).toString(),
            signal: controller.signal,
        })
        if (!response.ok) throw new Error(`Overpass respondeu HTTP ${response.status}`)
        return await response.json()
    } finally {
        clearTimeout(timer)
    }
}

function explicitHeightCoverage(overpassJson) {
    const candidates = (overpassJson.elements ?? []).filter((item) => item.tags?.building)
    const explicit = candidates.filter((item) => item.tags?.height || item.tags?.['building:levels'])
    return { explicit: explicit.length, total: candidates.length }
}

export async function buildCity(id, fetchImpl = fetch) {
    const source = citySource(id)
    const raw = await fetchOverpass(source, fetchImpl)
    const city = cityFromOsm(raw, {
        name: source.name,
        attribution: ATTRIBUTION,
        bbox: source.bbox,
        rotationDeg: source.rotationDeg,
    })
    const { relationsUsed, relationsSkipped, ...data } = city
    if (data.buildings.length === 0) throw new Error(`cidade sem prédios: ${id}`)

    const root = join(dirname(fileURLToPath(import.meta.url)), '..')
    const outputDir = join(root, 'public', 'swing')
    const outputFile = join(outputDir, source.output)
    await mkdir(outputDir, { recursive: true })
    const serialized = JSON.stringify(data)
    await writeFile(outputFile, serialized)
    const heights = explicitHeightCoverage(raw)
    const coverage = heights.total === 0 ? 0 : Math.round((heights.explicit / heights.total) * 100)
    console.log(
        `${source.name}: ${data.buildings.length} prédios, ${data.roads.length} vias, ` +
            `${serialized.length} bytes, altura explícita ${heights.explicit}/${heights.total} (${coverage}%), ` +
            `relações usadas ${relationsUsed}, ignoradas ${relationsSkipped}.`,
    )
    return { data, bytes: serialized.length, heights, outputFile }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    buildCity(process.argv[2] ?? 'midtown').catch((error) => {
        console.error(error instanceof Error ? error.message : error)
        process.exitCode = 1
    })
}
