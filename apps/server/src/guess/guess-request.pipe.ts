import { checkGuessLimits, guessRequestSchema } from '@guess-my-move/core'
import type { GuesserInput } from '@guess-my-move/core'
import {
    type ArgumentMetadata,
    Injectable,
    StandardSchemaValidationPipe,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import type { EnvironmentVariables } from '../config/environment.js'
import { ApiException } from './api-error.js'
import { guessLimitsFromConfig } from './limits.js'

/** Quantas mensagens de schema entram na resposta de `invalid_payload`. */
const MAX_REPORTED_ISSUES = 3

/**
 * Pipe da rota `POST /api/guess`. Estende o `StandardSchemaValidationPipe` do
 * NestJS 12: a validação estrutural usa `guessRequestSchema` (Zod, em
 * `@guess-my-move/core`) e herda a limpeza de chaves de protótipo. Depois, os
 * limites configuráveis (frames, bytes) são conferidos com `checkGuessLimits`.
 * Toda falha vira um `ApiException` estável, sem eco do conteúdo dos frames.
 */
@Injectable()
export class GuessRequestPipe extends StandardSchemaValidationPipe {
    constructor(
        private readonly config: ConfigService<EnvironmentVariables, true>,
    ) {
        super({
            exceptionFactory: (issues) => {
                const detail = issues
                    .slice(0, MAX_REPORTED_ISSUES)
                    .map((issue) => {
                        const path = (issue.path ?? [])
                            .map((segment) =>
                                String(
                                    typeof segment === 'object'
                                        ? segment.key
                                        : segment,
                                ),
                            )
                            .join('.')
                        return path ? `${path}: ${issue.message}` : issue.message
                    })
                    .join('; ')
                return new ApiException('invalid_payload', detail)
            },
        })
    }

    override async transform<T = unknown>(
        value: T,
        metadata: ArgumentMetadata,
    ): Promise<T> {
        const input = (await super.transform(value, {
            ...metadata,
            schema: guessRequestSchema,
        })) as GuesserInput
        const violation = checkGuessLimits(
            input,
            guessLimitsFromConfig(this.config),
        )
        if (violation) {
            throw new ApiException(violation.code, violation.message)
        }
        return input as T
    }
}
