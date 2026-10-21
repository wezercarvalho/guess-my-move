/**
 * Contrato de `POST /api/guess` (Zod): requisição, resposta e erro estável.
 * Servidor e front compartilham estes schemas. A requisição NÃO contém nenhum
 * dado da carta: os objetos são estritos e um campo extra é recusado.
 */
import * as z from 'zod/mini'

import { ptBR, strict, text, textList } from './builders.js'

/** MIME dos frames aceitos (JPEG, PNG e WebP da webcam). */
export const ALLOWED_FRAME_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
] as const

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/

/**
 * Frame capturado da webcam, transitório por natureza: nunca persistido e
 * nunca registrado em log. `data` é base64 sem o prefixo `data:`.
 */
export const capturedFrameSchema = strict({
    timestampMs: z.number({ error: ptBR }),
    mimeType: z.enum(ALLOWED_FRAME_MIME_TYPES, { error: ptBR }),
    data: text().check(
        z.minLength(1, { error: 'frame sem dados' }),
        z.refine((value) => value.length % 4 === 0 && BASE64.test(value), {
            error: 'não é base64 válido',
        }),
    ),
})

/**
 * Requisição ao adivinhador: frames em ordem crescente de tempo e, opcionalmente,
 * os palpites já rejeitados na rodada. Os limites configuráveis (quantidade e
 * bytes) são checados por `checkGuessLimits`, porque dependem da configuração.
 */
export const guessRequestSchema = strict({
    frames: z
        .array(capturedFrameSchema, { error: ptBR })
        .check(z.minLength(1, { error: 'frames ausente ou vazio' })),
    rejectedGuesses: z.exactOptional(textList()),
}).check(
    z.superRefine((request, ctx) => {
        for (let i = 1; i < request.frames.length; i += 1) {
            const previous = request.frames[i - 1]
            const current = request.frames[i]
            if (previous && current && current.timestampMs < previous.timestampMs) {
                ctx.addIssue({
                    code: 'custom',
                    path: ['frames', i, 'timestampMs'],
                    message: 'timestamps dos frames fora de ordem crescente',
                })
                return
            }
        }
    }),
)

/** Resposta de sucesso da rota: o palpite e metadados da execução. */
export const guessResponseSchema = strict({
    guess: text(),
    insufficientEvidence: z.exactOptional(z.boolean({ error: ptBR })),
    durationMs: z.number({ error: ptBR }),
    providerId: text(),
})

/** Códigos de erro estáveis expostos pela API. */
export const apiErrorCodeSchema = z.enum(
    [
        'invalid_payload',
        'payload_too_large',
        'rate_limited',
        'provider_timeout',
        'provider_error',
        'invalid_model_response',
        'cost_limit_reached',
    ],
    { error: ptBR },
)

/** Formato de erro estável da API. Nunca expõe detalhes internos do provedor. */
export const apiErrorSchema = strict({
    error: strict({
        code: apiErrorCodeSchema,
        message: text(),
        retryable: z.boolean({ error: ptBR }),
    }),
})

export type CapturedFrame = z.infer<typeof capturedFrameSchema>
/** Entrada do adivinhador. Contém só frames e palpites rejeitados. */
export type GuesserInput = z.infer<typeof guessRequestSchema>
export type GuessResponse = z.infer<typeof guessResponseSchema>
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>
export type ApiError = z.infer<typeof apiErrorSchema>

/** Resultado do adivinhador: um único palpite curto. */
export type GuesserResult = Pick<GuessResponse, 'guess' | 'insufficientEvidence'>

/** Limites aplicados a uma requisição, vindos da configuração do servidor. */
export interface GuessLimits {
    maxFrames: number
    maxFrameBytes: number
    maxTotalBytes: number
    maxRejectedGuesses: number
}

/** Violação de limite: código estável da API e mensagem segura. */
export interface GuessLimitViolation {
    code: Extract<ApiErrorCode, 'invalid_payload' | 'payload_too_large'>
    message: string
}

/** Bytes decodificados de uma string base64 (sem decodificar de fato). */
export function base64ByteLength(data: string): number {
    const padding = data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0
    return (data.length * 3) / 4 - padding
}

/**
 * Confere os limites configuráveis de uma requisição já validada pelo schema:
 * quantidade de frames, bytes por frame e totais (`payload_too_large`) e
 * quantidade de palpites rejeitados (`invalid_payload`). Função pura.
 */
export function checkGuessLimits(
    input: GuesserInput,
    limits: GuessLimits,
): GuessLimitViolation | null {
    if (input.frames.length > limits.maxFrames) {
        return {
            code: 'payload_too_large',
            message: `número de frames excede ${String(limits.maxFrames)}`,
        }
    }
    let total = 0
    for (const [index, frame] of input.frames.entries()) {
        const bytes = base64ByteLength(frame.data)
        if (bytes > limits.maxFrameBytes) {
            return {
                code: 'payload_too_large',
                message: `frame ${String(index)}: excede ${String(limits.maxFrameBytes)} bytes`,
            }
        }
        total += bytes
    }
    if (total > limits.maxTotalBytes) {
        return {
            code: 'payload_too_large',
            message: `tamanho total excede ${String(limits.maxTotalBytes)} bytes`,
        }
    }
    if ((input.rejectedGuesses?.length ?? 0) > limits.maxRejectedGuesses) {
        return {
            code: 'invalid_payload',
            message: `rejectedGuesses excede ${String(limits.maxRejectedGuesses)} itens`,
        }
    }
    return null
}
