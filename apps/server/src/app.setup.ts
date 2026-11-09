import { RealtimeAdapter } from './realtime/realtime.adapter.js'
import { RealtimePolicy } from './realtime/realtime-policy.service.js'
import { BackendTelemetry } from './observability/backend-telemetry.service.js'
import type { IncomingMessage, ServerResponse } from 'node:http'
import {
    type INestApplication,
    type NestApplicationOptions,
} from '@nestjs/common'
import { NodeAdapter } from '@nestjs/platform-node'
import { ObserveInstrument } from './observability/observe.setup.js'
import { SERVER_CONFIG, type ServerConfig } from './server-config.js'
import { NestFactory } from '@nestjs/core'

import { AppModule } from './app.module.js'

export async function createServerApp(
    options: NestApplicationOptions = {},
): Promise<INestApplication> {
    if (!ObserveInstrument)
        throw new Error('Instrumentação do SDK indisponível.')
    const adapter = new NodeAdapter()
    adapter.useBodyParser('json', false, { limit: 2048, inflate: false, type: (request) => (request.url ?? '').startsWith('/api/cards/') && /^application\/json(?:;|$)/i.test(request.headers['content-type'] ?? '') })
    const app = await NestFactory.create(AppModule, adapter, {
        bodyParser: false,
        instrument: ObserveInstrument,
        return503OnClosing: true,
        forceCloseConnections: true,
        routeConflictPolicy: { duplicate: 'error', shadow: 'warn' },
        ...options,
    })
    const config = app.get<ServerConfig>(SERVER_CONFIG)
    app.useWebSocketAdapter(
        new RealtimeAdapter(
            app,
            app.get(RealtimePolicy),
            app.get(BackendTelemetry),
        ),
    )
    app.enableCors({
        origin: config.allowedOrigins,
        methods: ['GET', 'HEAD', 'POST'],
        allowedHeaders: ['Authorization', 'Content-Type'],
    })
    app.use(
        (
            _request: IncomingMessage,
            response: ServerResponse,
            next: () => void,
        ) => {
            response.removeHeader('X-Powered-By')
            response.setHeader('X-Content-Type-Options', 'nosniff')
            next()
        },
    )
    return app
}
