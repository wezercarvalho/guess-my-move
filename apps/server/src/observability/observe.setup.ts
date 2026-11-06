import { randomUUID } from 'node:crypto'
import { createObserveModule, type ObserveOptions } from '@nestjs/observe'
import { CLIENT_EVENTS } from '@guess-my-move/marbles'
import type { ServerConfig } from '../server-config.js'

// IDs são gerados pelo servidor, nunca adotados de headers do cliente.
export const { ObserveModule, ObserveInstrument } = createObserveModule({
    sourceContext: false,
    traceIdGenerator: () => randomUUID(),
    attachTraceIdToLogs: false,
    // Somente adaptadores revisados: spans de método não incluem argumentos/retornos.
    // Serviços de domínio, configuração e telemetria ficam fora da instrumentação.
    skipInstrumentation: (instance: unknown) => {
        if (!instance || typeof instance !== 'object') return true
        const constructor: unknown = Reflect.get(instance, 'constructor')
        return (
            typeof constructor !== 'function' ||
            ![
                'HealthController',
                'ApiController',
                'MultiplayerGateway',
            ].includes(constructor.name)
        )
    },
})

export function observeHttpIgnored(request: unknown): boolean {
    if (!request || typeof request !== 'object') return true
    const url: unknown = Reflect.get(request, 'url')
    return url !== '/api/health' && url !== '/api/capabilities'
}

export function observeOptions(config: ServerConfig): ObserveOptions {
    return {
        enabled: config.observeEnabled,
        appKey: config.observeAppKey,
        appSecret: config.observeAppSecret,
        endpoint: config.observeEndpoint,
        serviceId: 'guess-my-move-server',
        serviceVersion: false,
        forwardLogs: false,
        outgoing: false,
        openTelemetry: false,
        runtimeMetrics: config.observeEnabled,
        runtimeMetricsInterval: 60_000,
        tracesSampleRate: config.observeSampleRate,
        maxTracesPerBatch: 100,
        flushInterval: 1000,
        shutdownFlushTimeout: 1000,
        http: {
            ignore: observeHttpIgnored,
            capture: false,
            queryParamsObfuscateRegex: /.*/,
        },
        ws: {
            ignore: (message) =>
                !Object.values(CLIENT_EVENTS).includes(
                    message.pattern as (typeof CLIENT_EVENTS)[keyof typeof CLIENT_EVENTS],
                ),
        },
        // Nenhum texto de erro arbitrário sai do processo; métricas e nomes fixos bastam.
        redaction: {
            enabled: true,
            useDefaultPatterns: true,
            patterns: [/[\s\S]+/g],
            keys: [
                'nickname',
                'resumeToken',
                'frame',
                'landmarks',
                'metricsToken',
            ],
        },
    }
}
