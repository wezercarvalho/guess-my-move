import { describe, expect, it } from 'vitest'

import { ApiException } from '../src/guess/api-error.js'
import {
    DEFAULT_ALLOWED_MIME_TYPES,
    type GuessLimits,
    validateGuessPayload,
} from '../src/guess/payload.js'

const limits: GuessLimits = {
    maxFrames: 6,
    maxFrameBytes: 1024,
    maxTotalBytes: 4096,
    allowedMimeTypes: DEFAULT_ALLOWED_MIME_TYPES,
    maxRejectedGuesses: 6,
}

const frame = (timestampMs: number, data = 'AAAA') => ({
    timestampMs,
    mimeType: 'image/jpeg',
    data,
})

function expectCode(body: unknown, code: string): void {
    try {
        validateGuessPayload(body, limits)
        throw new Error('esperava ApiException')
    } catch (error) {
        expect(error).toBeInstanceOf(ApiException)
        expect((error as ApiException).code).toBe(code)
    }
}

describe('validateGuessPayload', () => {
    it('aceita um payload válido e devolve GuesserInput', () => {
        const input = validateGuessPayload(
            { frames: [frame(0), frame(400)], rejectedGuesses: ['levantar a mão'] },
            limits,
        )
        expect(input.frames).toHaveLength(2)
        expect(input.rejectedGuesses).toEqual(['levantar a mão'])
    })

    it('rejeita corpo não objeto', () => {
        expectCode(null, 'invalid_payload')
        expectCode('x', 'invalid_payload')
    })

    it('rejeita frames vazio', () => {
        expectCode({ frames: [] }, 'invalid_payload')
    })

    it('rejeita excesso de frames com payload_too_large', () => {
        const frames = Array.from({ length: 7 }, (_, i) => frame(i * 100))
        expectCode({ frames }, 'payload_too_large')
    })

    it('rejeita mimeType não permitido', () => {
        expectCode({ frames: [{ ...frame(0), mimeType: 'image/gif' }] }, 'invalid_payload')
    })

    it('rejeita base64 inválido', () => {
        expectCode({ frames: [{ ...frame(0), data: 'não base64!' }] }, 'invalid_payload')
    })

    it('rejeita frame acima do limite de bytes', () => {
        const big = 'A'.repeat(4000)
        expectCode({ frames: [frame(0, big)] }, 'payload_too_large')
    })

    it('rejeita total acima do limite', () => {
        const chunk = 'A'.repeat(1000)
        const frames = [
            frame(0, chunk),
            frame(1, chunk),
            frame(2, chunk),
            frame(3, chunk),
            frame(4, chunk),
            frame(5, chunk),
        ]
        expectCode({ frames }, 'payload_too_large')
    })

    it('rejeita timestamps fora de ordem', () => {
        expectCode({ frames: [frame(400), frame(0)] }, 'invalid_payload')
    })

    it('rejeita rejectedGuesses não lista', () => {
        expectCode({ frames: [frame(0)], rejectedGuesses: 'x' }, 'invalid_payload')
    })

    it('rejeita rejectedGuesses com item não string', () => {
        expectCode({ frames: [frame(0)], rejectedGuesses: [1] }, 'invalid_payload')
    })

    it('rejeita rejectedGuesses acima do limite', () => {
        expectCode(
            { frames: [frame(0)], rejectedGuesses: Array.from({ length: 7 }, () => 'x') },
            'invalid_payload',
        )
    })
})
