import 'reflect-metadata'

import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'

import { AppModule } from './app.module.js'
import type { EnvironmentVariables } from './config/environment.js'
import { ApiExceptionFilter } from './guess/api-error.js'

async function bootstrap(): Promise<void> {
    const app = await NestFactory.create(AppModule)
    app.useGlobalFilters(new ApiExceptionFilter())
    const config = app.get(ConfigService<EnvironmentVariables, true>)
    const port = config.get('PORT', { infer: true })
    await app.listen(port)
    // Sem dados sensíveis no log: apenas a porta.
    console.log(`Servidor Guess My Move ouvindo na porta ${String(port)}`)
}

void bootstrap()
