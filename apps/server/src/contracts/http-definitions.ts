import { z } from 'zod'
import { MODE_IDS, RECONNECT_GRACE_MS } from '@guess-my-move/marbles'

export const healthResponseSchema = z.strictObject({ status: z.literal('ok') })
export const capabilitiesResponseSchema = z.strictObject({
    protocolVersion: z.literal(1),
    transport: z.literal('socket.io'),
    socketIoMajor: z.literal(4),
    path: z.literal('/socket.io'),
    namespace: z.literal('/'),
    modes: z.array(z.enum(MODE_IDS)),
    reconnectGraceMs: z.literal(RECONNECT_GRACE_MS),
    games: z.strictObject({
        marbles: z.strictObject({
            namespace: z.literal('/'),
            contract: z.literal('/api/contracts/multiplayer'),
        }),
        swing: z.strictObject({
            namespace: z.literal('/swing'),
            contract: z.literal('/api/contracts/swing'),
            maxPlayers: z.literal(2),
            cooperative: z.literal(true),
            cityIds: z.array(
                z.enum(['aurora', 'midtown', 'paulista', 'santa-maria']),
            ),
        }),
    }),
})
const count = () => z.number().int().nonnegative()
export const metricsResponseSchema = z.strictObject({
    acceptedConnections: count(),
    rejectedConnections: count(),
    rejectedOrigins: count(),
    rateLimited: count(),
    invalidCommands: count(),
    internalErrors: count(),
    telemetryFailures: count(),
    expiredRooms: count(),
    maxTickDelayMs: z.number().nonnegative(),
    activeConnections: count(),
    activeRooms: count(),
    operations: z.record(
        z.string(),
        z.strictObject({
            count: count(),
            errors: count(),
            totalMs: z.number().nonnegative(),
            maxMs: z.number().nonnegative(),
        }),
    ),
})
export const capabilities = () =>
    capabilitiesResponseSchema.parse({
        protocolVersion: 1,
        transport: 'socket.io',
        socketIoMajor: 4,
        path: '/socket.io',
        namespace: '/',
        modes: [...MODE_IDS],
        games: {
            marbles: { namespace: '/', contract: '/api/contracts/multiplayer' },
            swing: {
                namespace: '/swing',
                contract: '/api/contracts/swing',
                maxPlayers: 2,
                cooperative: true,
                cityIds: ['aurora', 'midtown', 'paulista', 'santa-maria'],
            },
        },
        reconnectGraceMs: RECONNECT_GRACE_MS,
    })
export const httpDefinitions = [
    {
        path: '/api/contracts/swing',
        operationId: 'getSwingContract',
        summary: 'Schemas do multiplayer cooperativo Arranha-Teia',
        schema: z.record(z.string(), z.unknown()),
        protected: false,
    },
    {
        path: '/api/health',
        operationId: 'getHealth',
        summary: 'Verificação de vida do processo',
        schema: healthResponseSchema,
        protected: false,
    },
    {
        path: '/api/capabilities',
        operationId: 'getCapabilities',
        summary: 'Capacidades públicas e transporte do multiplayer',
        schema: capabilitiesResponseSchema,
        protected: false,
    },
    {
        path: '/api/contracts/multiplayer',
        operationId: 'getMultiplayerContract',
        summary:
            'Schemas dos eventos Socket.IO; não são endpoints REST de jogo',
        schema: z.record(z.string(), z.unknown()),
        protected: false,
    },
    {
        path: '/api/metrics',
        operationId: 'getMetrics',
        summary:
            'Métricas agregadas de operação; habilitado somente com METRICS_TOKEN',
        schema: metricsResponseSchema,
        protected: true,
    },
] as const
