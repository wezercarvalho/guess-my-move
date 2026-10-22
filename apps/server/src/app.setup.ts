import type { NestExpressApplication } from '@nestjs/platform-express'
import { ConfigService } from '@nestjs/config'

import type { EnvironmentVariables } from './config/environment.js'
import { ApiExceptionFilter } from './guess/api-error.js'
import { guessLimitsFromConfig, jsonBodyLimitBytes } from './guess/limits.js'

/**
 * Configuração HTTP comum ao servidor e aos testes de integração: filtro de
 * erro estável e parser JSON com limite compatível com os frames. A aplicação
 * deve ser criada com `bodyParser: false`, pois o parser é registrado aqui.
 */
export function configureHttp(app: NestExpressApplication): void {
    const config = app.get(ConfigService<EnvironmentVariables, true>)
    app.useBodyParser('json', {
        limit: jsonBodyLimitBytes(guessLimitsFromConfig(config)),
    })
    app.useGlobalFilters(new ApiExceptionFilter())
}
