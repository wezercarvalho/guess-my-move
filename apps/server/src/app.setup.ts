import { type INestApplication, type NestApplicationOptions } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'

import { AppModule } from './app.module.js'

export function createServerApp(
    options: NestApplicationOptions = {},
): Promise<INestApplication> {
    return NestFactory.create(AppModule, { bodyParser: false, ...options })
}
