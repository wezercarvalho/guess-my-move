import { isIP } from 'node:net'
import { z } from 'zod'

const integer = (fallback: number, min: number, max: number) =>
    z.coerce.number().int().min(min).max(max).default(fallback)
const origin = z.string().refine((value) => {
    try {
        const url = new URL(value)
        return (
            ['http:', 'https:'].includes(url.protocol) && url.origin === value
        )
    } catch {
        return false
    }
}, 'Use uma origem HTTP(S) exata, sem caminho ou curinga.')
const ip = z
    .string()
    .refine(
        (value) => isIP(value) !== 0,
        'Use endereços IP explícitos, sem curinga.',
    )
const configSchema = z
    .object({
        enableApiDocs: z
            .enum(['true', 'false'])
            .default('false')
            .transform((value) => value === 'true'),
        metricsToken: z.string().min(32).max(512).optional(),
        observeEnabled: z
            .enum(['true', 'false'])
            .default('false')
            .transform((value) => value === 'true'),
        observeAppKey: z.string().max(512).default(''),
        observeAppSecret: z.string().max(512).default(''),
        observeSampleRate: z.coerce.number().min(0.001).max(1).default(0.1),
        observeEndpoint: z
            .string()
            .url()
            .default('https://observe-api.nestjs.com')
            .refine((value) => {
                const url = new URL(value)
                return (
                    !url.username &&
                    !url.password &&
                    !url.search &&
                    !url.hash &&
                    url.pathname === '/' &&
                    (url.protocol === 'https:' ||
                        (url.protocol === 'http:' &&
                            ['localhost', '127.0.0.1', '[::1]'].includes(
                                url.hostname,
                            )))
                )
            }, 'Coletor exige HTTPS; HTTP apenas em loopback para testes.'),
        port: integer(3000, 1, 65_535),
        maxRooms: integer(100, 1, 10_000),
        tickMs: integer(33, 15, 1000),
        waitingTimeoutMs: integer(300_000, 1000, 86_400_000),
        idleTimeoutMs: integer(900_000, 1000, 86_400_000),
        finishedTimeoutMs: integer(300_000, 1000, 86_400_000),
        maxConnections: integer(200, 1, 100_000),
        maxConnectionsPerIp: integer(10, 1, 100_000),
        roomAttemptsPerMinute: integer(20, 1, 10_000),
        maxTrackedAddresses: integer(10_000, 1, 100_000),
        allowedOrigins: z
            .array(origin)
            .min(1)
            .default(['http://localhost:5173', 'http://127.0.0.1:5173']),
        trustedProxyIps: z.array(ip).default([]),
        allowOriginless: z
            .enum(['true', 'false'])
            .default('false')
            .transform((value) => value === 'true'),
    })
    .strict()
    .superRefine((config, context) => {
        if (
            config.observeEnabled &&
            (!config.observeAppKey || !config.observeAppSecret)
        ) {
            context.addIssue({
                code: 'custom',
                message:
                    'Observe habilitado exige chave e segredo configurados.',
                path: ['observeEnabled'],
            })
        }
    })

export type ServerConfig = z.infer<typeof configSchema>
const list = (value: string | undefined) =>
    value?.split(',').map((item) => item.trim())

export function loadServerConfig(
    env: NodeJS.ProcessEnv | Record<string, string | undefined>,
): ServerConfig {
    return configSchema.parse({
        enableApiDocs: env.ENABLE_API_DOCS,
        metricsToken: env.METRICS_TOKEN,
        observeEnabled: env.OBSERVE_ENABLED,
        observeAppKey: env.OBSERVE_APP_KEY,
        observeAppSecret: env.OBSERVE_APP_SECRET,
        observeEndpoint: env.OBSERVE_ENDPOINT,
        observeSampleRate: env.OBSERVE_SAMPLE_RATE,
        port: env.PORT,
        maxRooms: env.MAX_ROOMS,
        tickMs: env.SERVER_TICK_MS,
        waitingTimeoutMs: env.ROOM_WAITING_TIMEOUT_MS,
        idleTimeoutMs: env.ROOM_IDLE_TIMEOUT_MS,
        finishedTimeoutMs: env.ROOM_FINISHED_TIMEOUT_MS,
        maxConnections: env.MAX_CONNECTIONS,
        maxConnectionsPerIp: env.MAX_CONNECTIONS_PER_IP,
        roomAttemptsPerMinute: env.ROOM_ATTEMPTS_PER_MINUTE,
        maxTrackedAddresses: env.MAX_TRACKED_ADDRESSES,
        allowedOrigins: list(env.ALLOWED_ORIGINS),
        trustedProxyIps: list(env.TRUSTED_PROXY_IPS),
        allowOriginless: env.ALLOW_ORIGINLESS_CLIENTS,
    })
}

export const SERVER_CONFIG = Symbol('SERVER_CONFIG')
