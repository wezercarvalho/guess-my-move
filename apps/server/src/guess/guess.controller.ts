import type { GuesserInput } from '@guess-my-move/core'
import { Body, Controller, HttpCode, Post } from '@nestjs/common'

import { GuessRequestPipe } from './guess-request.pipe.js'
import { type GuessResponse, GuessService } from './guess.service.js'

/**
 * `POST /api/guess`: recebe `{ frames, rejectedGuesses? }`. A rota NÃO conhece
 * a carta — nenhum dado de carta entra aqui. O `GuessRequestPipe` valida o
 * corpo (schema Zod do `core` mais os limites da configuração) antes do
 * handler; falhas viram um `ApiError` estável.
 */
@Controller('api/guess')
export class GuessController {
    constructor(private readonly service: GuessService) {}

    @Post()
    @HttpCode(200)
    async guess(
        @Body(GuessRequestPipe) input: GuesserInput,
    ): Promise<GuessResponse> {
        return this.service.guess(input)
    }
}
