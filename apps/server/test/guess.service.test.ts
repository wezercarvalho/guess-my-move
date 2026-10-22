import type { GuesserInput } from '@guess-my-move/core'
import {
    GuesserProviderRegistry,
    MockGuesserProvider,
    MockProviderError,
} from '@guess-my-move/providers'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiException } from '../src/guess/api-error.js'
import type { EnvironmentVariables } from '../src/config/environment.js'
import { GuessMetricsLogger, type GuessMetric } from '../src/guess/metrics.js'
import { GuessService } from '../src/guess/guess.service.js'

const input: GuesserInput = {
    frames: [{ timestampMs: 0, mimeType: 'image/jpeg', data: 'AAAA' }],
}

type Env = EnvironmentVariables

function makeConfig(overrides: Partial<Env> = {}) {
    const values: Record<string, unknown> = {
        GUESSER_PROVIDER: 'mock',
        REQUEST_TIMEOUT_MS: 15000,
        RATE_LIMIT_PER_MINUTE: 20,
        COST_CEILING_ATTEMPTS_PER_HOUR: 60,
        MAX_FRAMES: 6,
        MAX_FRAME_BYTES: 262144,
        MAX_TOTAL_BYTES: 1572864,
        ...overrides,
    }
    return { get: (key: string) => values[key] } as never
}

function makeService(
    registry: GuesserProviderRegistry,
    overrides: Partial<Env> = {},
): { service: GuessService; metrics: GuessMetric[] } {
    const metrics: GuessMetric[] = []
    const logger = new GuessMetricsLogger()
    vi.spyOn(logger, 'record').mockImplementation((m) => metrics.push(m))
    const service = new GuessService(makeConfig(overrides), registry, logger)
    return { service, metrics }
}

describe('GuessService', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
    })

    it('devolve palpite, durationMs e providerId e registra métrica de sucesso', async () => {
        const registry = new GuesserProviderRegistry().register(
            'mock',
            () => new MockGuesserProvider({ guess: 'acenar' }),
        )
        const { service, metrics } = makeService(registry)
        const response = await service.guess(input)
        expect(response.guess).toBe('acenar')
        expect(response.providerId).toBe('mock')
        expect(typeof response.durationMs).toBe('number')
        expect(metrics[0]).toMatchObject({
            event: 'guess_attempt',
            outcome: 'success',
            providerId: 'mock',
            frameCount: 1,
        })
    })

    it('propaga evidência insuficiente', async () => {
        const registry = new GuesserProviderRegistry().register(
            'mock',
            () => new MockGuesserProvider({ insufficientEvidence: true }),
        )
        const { service } = makeService(registry)
        expect((await service.guess(input)).insufficientEvidence).toBe(true)
    })

    it('converte timeout em provider_timeout', async () => {
        const registry = new GuesserProviderRegistry().register(
            'mock',
            () => new MockGuesserProvider({ delayMs: 10_000 }),
        )
        const { service, metrics } = makeService(registry, {
            REQUEST_TIMEOUT_MS: 10,
        })
        await expect(service.guess(input)).rejects.toMatchObject({
            code: 'provider_timeout',
        })
        expect(metrics[0]).toMatchObject({
            outcome: 'error',
            errorCode: 'provider_timeout',
        })
    })

    it('converte erro do provedor em provider_error', async () => {
        const registry = new GuesserProviderRegistry().register(
            'mock',
            () => new MockGuesserProvider({ error: new MockProviderError() }),
        )
        const { service } = makeService(registry)
        await expect(service.guess(input)).rejects.toMatchObject({
            code: 'provider_error',
        })
    })

    it('aplica rate limit por minuto', async () => {
        const registry = new GuesserProviderRegistry().register(
            'mock',
            () => new MockGuesserProvider(),
        )
        const { service } = makeService(registry, { RATE_LIMIT_PER_MINUTE: 1 })
        await service.guess(input)
        await expect(service.guess(input)).rejects.toMatchObject({
            code: 'rate_limited',
        })
    })

    it('aplica teto de custo por hora', async () => {
        const registry = new GuesserProviderRegistry().register(
            'mock',
            () => new MockGuesserProvider(),
        )
        const { service } = makeService(registry, {
            COST_CEILING_ATTEMPTS_PER_HOUR: 1,
        })
        await service.guess(input)
        await expect(service.guess(input)).rejects.toMatchObject({
            code: 'cost_limit_reached',
        })
    })

    it('a métrica nunca carrega conteúdo de frame', async () => {
        const registry = new GuesserProviderRegistry().register(
            'mock',
            () => new MockGuesserProvider(),
        )
        const { service, metrics } = makeService(registry)
        await service.guess(input)
        const serialized = JSON.stringify(metrics)
        expect(serialized).not.toContain('AAAA')
        expect(serialized).not.toContain('image/jpeg')
    })

    it('registra a causa sanitizada na métrica de erro, sem expô-la ao cliente', async () => {
        const registry = new GuesserProviderRegistry().register(
            'mock',
            () =>
                new MockGuesserProvider({
                    error: new Error(
                        "ERROR: You've hit your usage limit QUJD".padEnd(10) +
                            'QUJD'.repeat(40),
                    ),
                }),
        )
        const { service, metrics } = makeService(registry)
        const failure = await service.guess(input).catch((e: unknown) => e)
        expect(failure).toBeInstanceOf(ApiException)
        expect(JSON.stringify((failure as ApiException).getResponse())).not.toContain(
            'usage limit',
        )
        expect(metrics[0]).toMatchObject({
            outcome: 'error',
            errorCode: 'provider_error',
        })
        expect(metrics[0]?.cause).toContain("You've hit your usage limit")
        expect(metrics[0]?.cause).not.toContain('QUJD'.repeat(40))
    })

    it('a métrica de sucesso não tem causa', async () => {
        const registry = new GuesserProviderRegistry().register(
            'mock',
            () => new MockGuesserProvider(),
        )
        const { service, metrics } = makeService(registry)
        await service.guess(input)
        expect(metrics[0]).not.toHaveProperty('cause')
    })

    it('a ApiException nunca é construída com código fora do contrato', () => {
        expect(() => new ApiException('rate_limited', 'x').code).not.toThrow()
    })
})
