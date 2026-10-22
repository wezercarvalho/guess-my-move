import 'reflect-metadata'

import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'

import { AppModule } from './app.module.js'
import { configureHttp } from './app.setup.js'
import type { EnvironmentVariables } from './config/environment.js'

async function bootstrap(): Promise<void> {
    const app = await NestFactory.create<NestExpressApplication>(AppModule, {
        bodyParser: false,
    })
    configureHttp(app)
    const config = app.get(ConfigService<EnvironmentVariables, true>)
    const port = config.get('PORT', { infer: true })
    await app.listen(port)
    // Sem dados sensíveis no log: apenas a porta.
    console.log(`Servidor Guess My Move ouvindo na porta ${String(port)}`)
}

void bootstrap()
