import type { IncomingMessage, ServerResponse } from 'node:http'
import {
    type INestApplication,
    type NestApplicationOptions,
} from '@nestjs/common'
import { NestFactory } from '@nestjs/core'

import { AppModule } from './app.module.js'

export async function createServerApp(
    options: NestApplicationOptions = {},
): Promise<INestApplication> {
    const app = await NestFactory.create(AppModule, {
        bodyParser: false,
        ...options,
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
