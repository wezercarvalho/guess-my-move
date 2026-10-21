import { ConfigService } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import { createDefaultRegistry } from '@guess-my-move/providers'
import { beforeAll, describe, expect, it } from 'vitest'

import { ApiException } from '../src/guess/api-error.js'
import { GuessController } from '../src/guess/guess.controller.js'
import { GUESSER_REGISTRY, GuessService } from '../src/guess/guess.service.js'
import { GuessMetricsLogger } from '../src/guess/metrics.js'

const env: Record<string, unknown> = {
    GUESSER_PROVIDER: 'mock',
    REQUEST_TIMEOUT_MS: 15000,
    RATE_LIMIT_PER_MINUTE: 100,
    COST_CEILING_ATTEMPTS_PER_HOUR: 100,
    MAX_FRAMES: 6,
    MAX_FRAME_BYTES: 262144,
    MAX_TOTAL_BYTES: 1572864,
}

describe('GuessController (fluxo completo, modo mock, sem credencial)', () => {
    let controller: GuessController

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            controllers: [GuessController],
            providers: [
                GuessService,
                GuessMetricsLogger,
                {
                    provide: ConfigService,
                    useValue: { get: (key: string) => env[key] },
                },
                { provide: GUESSER_REGISTRY, useFactory: createDefaultRegistry },
            ],
        }).compile()
        controller = moduleRef.get(GuessController)
    })

    it('devolve um palpite para um payload válido', async () => {
        const response = await controller.guess({
            frames: [
                { timestampMs: 0, mimeType: 'image/jpeg', data: 'AAAA' },
                { timestampMs: 400, mimeType: 'image/jpeg', data: 'BBBB' },
            ],
        })
        expect(response.providerId).toBe('mock')
        expect(response.guess.length).toBeGreaterThan(0)
    })

    it('rejeita payload inválido com ApiException estável', async () => {
        await expect(controller.guess({ frames: [] })).rejects.toBeInstanceOf(
            ApiException,
        )
    })
})
