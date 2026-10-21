import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createDefaultRegistry } from '@guess-my-move/providers'

import type { EnvironmentVariables } from '../config/environment.js'
import { GuessController } from './guess.controller.js'
import { GUESSER_REGISTRY, GuessService } from './guess.service.js'
import { GuessMetricsLogger } from './metrics.js'

/**
 * Módulo da rota de adivinhação. O registro de provedores é montado a partir da
 * configuração: o `mock` está sempre disponível; o `codex` só é adicionado
 * quando `GUESSER_PROVIDER=codex` (adaptador adicionado na issue #7).
 */
@Module({
    controllers: [GuessController],
    providers: [
        GuessService,
        GuessMetricsLogger,
        {
            provide: GUESSER_REGISTRY,
            inject: [ConfigService],
            useFactory: (
                config: ConfigService<EnvironmentVariables, true>,
            ) => {
                void config
                // Branch #6: apenas o mock. O codex é registrado na issue #7.
                return createDefaultRegistry()
            },
        },
    ],
})
export class GuessModule {}
