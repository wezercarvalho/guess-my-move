import { createDefaultRegistry } from '@guess-my-move/providers'
import type { INestApplication } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ApiExceptionFilter } from '../src/guess/api-error.js'
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

const frame = (index: number) => ({
    timestampMs: index * 400,
    mimeType: 'image/jpeg',
    data: Buffer.from(`frame-${String(index)}`).toString('base64'),
})

describe('POST /api/guess pela camada HTTP (loopback, modo mock)', () => {
    let app: INestApplication
    let base: string

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
        app = moduleRef.createNestApplication()
        app.useGlobalFilters(new ApiExceptionFilter())
        await app.listen(0, '127.0.0.1')
        base = await app.getUrl()
    })

    afterAll(async () => {
        await app.close()
    })

    const post = async (body: string) => {
        const response = await fetch(`${base}/api/guess`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body,
        })
        return {
            status: response.status,
            body: (await response.json()) as Record<string, unknown>,
        }
    }

    it('responde 200 com palpite, duração e provedor', async () => {
        const result = await post(JSON.stringify({ frames: [frame(0), frame(1)] }))
        expect(result.status).toBe(200)
        expect(typeof result.body['guess']).toBe('string')
        expect(typeof result.body['durationMs']).toBe('number')
        expect(result.body['providerId']).toBe('mock')
    })

    it('JSON malformado vira invalid_payload 400, sem detalhe interno', async () => {
        const result = await post('{nao-json')
        expect(result.status).toBe(400)
        expect(result.body).toEqual({
            error: {
                code: 'invalid_payload',
                message: 'requisição inválida',
                retryable: false,
            },
        })
    })

    it('rota inexistente devolve ApiError estável 404', async () => {
        const response = await fetch(`${base}/api/inexistente`)
        const body = (await response.json()) as {
            error: { code: string; retryable: boolean }
        }
        expect(response.status).toBe(404)
        expect(body.error.code).toBe('invalid_payload')
        expect(body.error.retryable).toBe(false)
    })
})
