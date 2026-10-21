import type { CapturedFrame, GuesserInput } from '@guess-my-move/core'

import { ApiException } from './api-error.js'

/** Limites aplicados à rota `POST /api/guess`, vindos da configuração. */
export interface GuessLimits {
    maxFrames: number
    maxFrameBytes: number
    maxTotalBytes: number
    allowedMimeTypes: readonly string[]
    maxRejectedGuesses: number
}

/** Limites padrão do MIME; a lista é fechada (JPEG/PNG/WebP da webcam). */
export const DEFAULT_ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
] as const

const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/

/** Bytes decodificados de uma string base64 (sem decodificar de fato). */
function base64Bytes(data: string): number {
    const len = data.length
    const padding = data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0
    return (len * 3) / 4 - padding
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function invalid(message: string): never {
    throw new ApiException('invalid_payload', message)
}

function tooLarge(message: string): never {
    throw new ApiException('payload_too_large', message)
}

function parseFrame(raw: unknown, index: number, limits: GuessLimits): CapturedFrame {
    if (!isRecord(raw)) {
        invalid(`frame ${index} não é um objeto`)
    }
    const { timestampMs, mimeType, data } = raw
    if (typeof timestampMs !== 'number' || !Number.isFinite(timestampMs)) {
        invalid(`frame ${index}: timestampMs inválido`)
    }
    if (typeof mimeType !== 'string') {
        invalid(`frame ${index}: mimeType inválido`)
    }
    if (!limits.allowedMimeTypes.includes(mimeType)) {
        invalid(`frame ${index}: mimeType "${mimeType}" não permitido`)
    }
    if (typeof data !== 'string' || data.length === 0) {
        invalid(`frame ${index}: data ausente`)
    }
    if (!BASE64_RE.test(data) || data.length % 4 !== 0) {
        invalid(`frame ${index}: data não é base64 válido`)
    }
    if (base64Bytes(data) > limits.maxFrameBytes) {
        tooLarge(`frame ${index}: excede ${String(limits.maxFrameBytes)} bytes`)
    }
    return { timestampMs, mimeType, data }
}

/**
 * Valida o corpo bruto de `POST /api/guess` e devolve um `GuesserInput` tipado.
 * O corpo NÃO contém nenhum dado de carta — a rota não conhece a carta. Regras:
 * quantidade de frames, tamanho por frame e total, mimeType permitido, base64
 * válido, timestamps em ordem crescente e `rejectedGuesses` limitado.
 */
export function validateGuessPayload(
    body: unknown,
    limits: GuessLimits,
): GuesserInput {
    if (!isRecord(body)) {
        invalid('corpo da requisição ausente ou inválido')
    }
    const { frames, rejectedGuesses } = body
    if (!Array.isArray(frames) || frames.length === 0) {
        invalid('frames ausente ou vazio')
    }
    if (frames.length > limits.maxFrames) {
        tooLarge(`número de frames excede ${String(limits.maxFrames)}`)
    }

    const parsed: CapturedFrame[] = frames.map((frame, index) =>
        parseFrame(frame, index, limits),
    )

    let totalBytes = 0
    for (let i = 0; i < parsed.length; i++) {
        totalBytes += base64Bytes(parsed[i].data)
        if (i > 0 && parsed[i].timestampMs < parsed[i - 1].timestampMs) {
            invalid('timestamps dos frames fora de ordem crescente')
        }
    }
    if (totalBytes > limits.maxTotalBytes) {
        tooLarge(`tamanho total excede ${String(limits.maxTotalBytes)} bytes`)
    }

    const result: GuesserInput = { frames: parsed }

    if (rejectedGuesses !== undefined) {
        if (!Array.isArray(rejectedGuesses)) {
            invalid('rejectedGuesses deve ser uma lista de strings')
        }
        if (rejectedGuesses.length > limits.maxRejectedGuesses) {
            invalid(
                `rejectedGuesses excede ${String(limits.maxRejectedGuesses)} itens`,
            )
        }
        const clean = rejectedGuesses.map((item, index) => {
            if (typeof item !== 'string') {
                invalid(`rejectedGuesses[${String(index)}] não é string`)
            }
            return item
        })
        result.rejectedGuesses = clean
    }

    return result
}
