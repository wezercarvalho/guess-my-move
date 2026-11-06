import { readFileSync } from 'node:fs'
import { z } from 'zod'
import {
    createCityIndex,
    createOnlineTrainingCity,
    DEFAULT_SWING,
    type City,
    type CityIndex,
    type SwingConfig,
} from '@guess-my-move/swing'

const finite = z.number().finite()
const shape = z.object({
    version: z.literal(1),
    name: z.string(),
    attribution: z.string(),
    bounds: z.object({
        minX: finite,
        maxX: finite,
        minZ: finite,
        maxZ: finite,
    }),
    buildings: z.array(
        z.object({
            height: finite.nonnegative(),
            ring: z.array(finite).min(6),
        }),
    ),
    roads: z.array(
        z.object({
            width: finite,
            name: z.string().optional(),
            line: z.array(finite),
        }),
    ),
})
export interface SwingCity {
    index: CityIndex
    config: SwingConfig
}
export type SwingCityLoader = (id: string) => SwingCity
const entries = { midtown: 90, paulista: 55, 'santa-maria': 20 } as const
const cache = new Map<string, SwingCity>()
/** Paths are selected exclusively from the application catalog, never from a command. */
export function loadSwingCity(id: string): SwingCity {
    const cached = cache.get(id)
    if (cached) return cached
    let city: City
    let spawnHeight = 90
    if (id === 'aurora') city = createOnlineTrainingCity()
    else {
        if (!Object.hasOwn(entries, id)) throw new Error('Cidade indisponível.')
        const key = id as keyof typeof entries
        spawnHeight = entries[key]
        const path = new URL(
            `../../../web/public/swing/${key}.json`,
            import.meta.url,
        )
        const parsed = shape.parse(JSON.parse(readFileSync(path, 'utf8')))
        city = {
            ...parsed,
            roads: parsed.roads.map((road) => ({
                width: road.width,
                line: road.line,
                ...(road.name === undefined ? {} : { name: road.name }),
            })),
        }
    }
    const result = {
        index: createCityIndex(city),
        config: { ...DEFAULT_SWING, spawnHeight },
    }
    cache.set(id, result)
    return result
}
