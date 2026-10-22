import type { ConfigService } from '@nestjs/config'
import { describe, expect, it } from 'vitest'

import type { EnvironmentVariables } from '../src/config/environment.js'
import { ApiException } from '../src/guess/api-error.js'
import { GuessRequestPipe } from '../src/guess/guess-request.pipe.js'

const env: Record<string, unknown> = {
    MAX_FRAMES: 6,
    MAX_FRAME_BYTES: 1024,
    MAX_TOTAL_BYTES: 4096,
}

const pipe = new GuessRequestPipe({
    get: (key: string) => env[key],
} as unknown as ConfigService<EnvironmentVariables, true>)

const frame = (timestampMs: number, data = 'AAAA') => ({
    timestampMs,
    mimeType: 'image/jpeg',
    data,
})

async function code(body: unknown): Promise<string> {
    try {
        await pipe.transform(body, { type: 'body' })
    } catch (error) {
        expect(error).toBeInstanceOf(ApiException)
        return (error as ApiException).code
    }
    throw new Error('esperava ApiException')
}

describe('GuessRequestPipe', () => {
    it('aceita um payload válido e devolve a entrada tipada', async () => {
        const input = await pipe.transform(
            { frames: [frame(0), frame(400)], rejectedGuesses: ['levantar a mão'] },
            { type: 'body' },
        )
        expect(input).toEqual({
            frames: [frame(0), frame(400)],
            rejectedGuesses: ['levantar a mão'],
        })
    })

    it.each([
        ['corpo nulo', null],
        ['corpo texto', 'x'],
        ['frames vazio', { frames: [] }],
        ['MIME não permitido', { frames: [{ ...frame(0), mimeType: 'image/gif' }] }],
        ['base64 inválido', { frames: [{ ...frame(0), data: 'não base64!' }] }],
        ['timestamps fora de ordem', { frames: [frame(400), frame(0)] }],
        ['rejectedGuesses não é lista', { frames: [frame(0)], rejectedGuesses: 'x' }],
        ['rejectedGuesses com item não texto', { frames: [frame(0)], rejectedGuesses: [1] }],
    ])('recusa com invalid_payload: %s', async (_name, body) => {
        expect(await code(body)).toBe('invalid_payload')
    })

    it('recusa rejectedGuesses acima do limite com invalid_payload', async () => {
        const rejectedGuesses = Array.from({ length: 7 }, () => 'x')
        expect(await code({ frames: [frame(0)], rejectedGuesses })).toBe(
            'invalid_payload',
        )
    })

    it('recusa campo extra, inclusive dado da carta, com invalid_payload', async () => {
        expect(
            await code({ frames: [frame(0)], card: { word: 'acenar' } }),
        ).toBe('invalid_payload')
    })

    it('recusa excesso de frames, frame grande e total grande com payload_too_large', async () => {
        const many = Array.from({ length: 7 }, (_, i) => frame(i * 100))
        expect(await code({ frames: many })).toBe('payload_too_large')
        expect(await code({ frames: [frame(0, 'A'.repeat(4000))] })).toBe(
            'payload_too_large',
        )
        const chunk = 'A'.repeat(1000)
        const six = Array.from({ length: 6 }, (_, i) => frame(i, chunk))
        expect(await code({ frames: six })).toBe('payload_too_large')
    })

    it('não ecoa o conteúdo dos frames na mensagem de erro', async () => {
        try {
            await pipe.transform(
                { frames: [{ ...frame(0), data: 'segredo-não-base64!' }] },
                { type: 'body' },
            )
        } catch (error) {
            expect(JSON.stringify((error as ApiException).getResponse())).not.toContain(
                'segredo',
            )
            return
        }
        throw new Error('esperava ApiException')
    })
})
