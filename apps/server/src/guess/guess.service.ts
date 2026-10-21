import type { GuesserInput, GuesserResult } from '@guess-my-move/core'
import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
    type GuesserProviderName,
    GuesserProviderRegistry,
    InvalidProviderOutputError,
} from '@guess-my-move/providers'

import { ApiException } from './api-error.js'
import type { EnvironmentVariables } from '../config/environment.js'
import { GuessMetricsLogger } from './metrics.js'
import { DEFAULT_ALLOWED_MIME_TYPES, type GuessLimits } from './payload.js'
import { SlidingWindowCounter } from './rate-limit.js'

/** Token de injeção do registro de provedores. */
export const GUESSER_REGISTRY = Symbol('GUESSER_REGISTRY')

/** Resposta de sucesso da rota `POST /api/guess`. */
export interface GuessResponse extends GuesserResult {
    durationMs: number
    providerId: string
}

const MINUTE_MS = 60_000
const HOUR_MS = 3_600_000

@Injectable()
export class GuessService {
    private readonly perMinute: SlidingWindowCounter
    private readonly perHour: SlidingWindowCounter
    private readonly timeoutMs: number
    private readonly providerName: GuesserProviderName

    constructor(
        private readonly config: ConfigService<EnvironmentVariables, true>,
        @Inject(GUESSER_REGISTRY)
        private readonly registry: GuesserProviderRegistry,
        private readonly metrics: GuessMetricsLogger,
    ) {
        this.timeoutMs = this.config.get('REQUEST_TIMEOUT_MS', { infer: true })
        this.providerName = this.config.get('GUESSER_PROVIDER', {
            infer: true,
        })
        this.perMinute = new SlidingWindowCounter(
            this.config.get('RATE_LIMIT_PER_MINUTE', { infer: true }),
            MINUTE_MS,
        )
        this.perHour = new SlidingWindowCounter(
            this.config.get('COST_CEILING_ATTEMPTS_PER_HOUR', { infer: true }),
            HOUR_MS,
        )
    }

    /** Limites de payload derivados da configuração. */
    get limits(): GuessLimits {
        return {
            maxFrames: this.config.get('MAX_FRAMES', { infer: true }),
            maxFrameBytes: this.config.get('MAX_FRAME_BYTES', { infer: true }),
            maxTotalBytes: this.config.get('MAX_TOTAL_BYTES', { infer: true }),
            allowedMimeTypes: DEFAULT_ALLOWED_MIME_TYPES,
            maxRejectedGuesses: this.config.get('MAX_FRAMES', { infer: true }),
        }
    }

    async guess(input: GuesserInput): Promise<GuessResponse> {
        if (!this.perMinute.canProceed()) {
            throw new ApiException(
                'rate_limited',
                'muitas tentativas; tente novamente em instantes',
            )
        }
        if (!this.perHour.canProceed()) {
            throw new ApiException(
                'cost_limit_reached',
                'teto de tentativas por hora atingido',
            )
        }
        this.perMinute.record()
        this.perHour.record()

        const provider = this.registry.create(this.providerName)
        const controller = new AbortController()
        const timer = setTimeout(() => {
            controller.abort()
        }, this.timeoutMs)
        const startedAt = Date.now()

        try {
            const result = await provider.guess(input, controller.signal)
            const durationMs = Date.now() - startedAt
            this.metrics.record({
                event: 'guess_attempt',
                outcome: 'success',
                providerId: provider.id,
                frameCount: input.frames.length,
                durationMs,
            })
            const response: GuessResponse = {
                guess: result.guess,
                durationMs,
                providerId: provider.id,
            }
            if (result.insufficientEvidence !== undefined) {
                response.insufficientEvidence = result.insufficientEvidence
            }
            return response
        } catch (cause) {
            const durationMs = Date.now() - startedAt
            const apiError = this.toApiException(controller.signal, cause)
            this.metrics.record({
                event: 'guess_attempt',
                outcome: 'error',
                providerId: provider.id,
                frameCount: input.frames.length,
                durationMs,
                errorCode: apiError.code,
            })
            throw apiError
        } finally {
            clearTimeout(timer)
        }
    }

    private toApiException(signal: AbortSignal, cause: unknown): ApiException {
        if (cause instanceof ApiException) {
            return cause
        }
        if (signal.aborted) {
            return new ApiException(
                'provider_timeout',
                'o provedor não respondeu a tempo',
                cause,
            )
        }
        if (cause instanceof InvalidProviderOutputError) {
            return new ApiException(
                'invalid_model_response',
                'resposta do provedor fora do formato esperado',
                cause,
            )
        }
        return new ApiException(
            'provider_error',
            'falha ao obter o palpite do provedor',
            cause,
        )
    }
}
