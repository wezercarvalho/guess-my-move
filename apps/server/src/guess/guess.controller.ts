import { Body, Controller, HttpCode, Post } from '@nestjs/common'

import { type GuessResponse, GuessService } from './guess.service.js'
import { validateGuessPayload } from './payload.js'

/**
 * `POST /api/guess`: recebe `{ frames, rejectedGuesses? }`. A rota NÃO conhece
 * a carta — nenhum dado de carta entra aqui. Valida o payload, aplica limites e
 * devolve um palpite ou um `ApiError` estável.
 */
@Controller('api/guess')
export class GuessController {
    constructor(private readonly service: GuessService) {}

    @Post()
    @HttpCode(200)
    async guess(@Body() body: unknown): Promise<GuessResponse> {
        const input = validateGuessPayload(body, this.service.limits)
        return this.service.guess(input)
    }
}
