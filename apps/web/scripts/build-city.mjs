// Busca o trecho de Midtown na Overpass API, converte para o formato City v1 e
// grava `apps/web/public/swing/midtown.json` compacto (sem espaços).
//
// Sem dependência nova: usa `fetch`, `AbortController` e as APIs de arquivo do
// Node. Rodar com `node scripts/build-city.mjs`.
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cityFromOsm } from './city-from-osm.mjs'

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'
const USER_AGENT = 'guess-my-move-research/0.1 (github.com/wezercarvalho/guess-my-move)'
const TIMEOUT_MS = 90_000

// Bbox do trecho (sul, oeste, norte, leste), igual ao do conversor e do brief.
const BBOX = '40.7540,-73.9900,40.7620,-73.9805'

// Classes de via que viram pista no jogo (as mesmas larguras do conversor).
const HIGHWAY_CLASSES =
    'motorway|trunk|primary|secondary|tertiary|residential|unclassified|living_street|pedestrian|service'

// Consulta Overpass: prédios (ways e relações multipolígono) e vias, com geometria.
const QUERY = `[out:json][timeout:90];
(
  way[building](${BBOX});
  relation[building][type=multipolygon](${BBOX});
  way[highway~"^(${HIGHWAY_CLASSES})$"](${BBOX});
);
out geom tags;`

/** Faz o POST na Overpass com timeout e devolve o JSON já parseado. */
async function fetchOverpass() {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
        const response = await fetch(OVERPASS_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': USER_AGENT,
            },
            body: new URLSearchParams({ data: QUERY }).toString(),
            signal: controller.signal,
        })
        if (!response.ok) {
            throw new Error(`Overpass respondeu HTTP ${response.status}`)
        }
        return await response.json()
    } finally {
        clearTimeout(timer)
    }
}

async function main() {
    const root = join(dirname(fileURLToPath(import.meta.url)), '..')
    const outputDir = join(root, 'public', 'swing')
    const outputFile = join(outputDir, 'midtown.json')

    const overpassJson = await fetchOverpass()
    const city = cityFromOsm(overpassJson)

    // Separa as contagens de diagnóstico do objeto City gravado.
    const { relationsUsed, relationsSkipped, ...cityData } = city

    await mkdir(outputDir, { recursive: true })
    const serialized = JSON.stringify(cityData)
    await writeFile(outputFile, serialized)

    console.log(
        `Cidade gravada: ${cityData.buildings.length} prédios, ${cityData.roads.length} vias, ` +
            `relações usadas ${relationsUsed}, ignoradas ${relationsSkipped}, ` +
            `${serialized.length} bytes.`,
    )
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main().catch((error) => {
        console.error(error instanceof Error ? error.message : error)
        process.exitCode = 1
    })
}
