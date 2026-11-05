import { z } from 'zod'

const configSchema = z
    .object({
        port: z.coerce.number().int().min(1).max(65_535).default(3000),
        maxRooms: z.coerce.number().int().min(1).max(10_000).default(100),
        tickMs: z.coerce.number().int().min(15).max(1_000).default(33),
    })
    .strict()

export interface ServerConfig {
    port: number
    maxRooms: number
    tickMs: number
}

export function loadServerConfig(env: NodeJS.ProcessEnv | Record<string, string | undefined>): ServerConfig {
    return configSchema.parse({
        port: env.PORT,
        maxRooms: env.MAX_ROOMS,
        tickMs: env.SERVER_TICK_MS,
    })
}

export const SERVER_CONFIG = Symbol('SERVER_CONFIG')
