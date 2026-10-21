import { describe, expect, it, vi } from 'vitest'

import {
    GuessApiError,
    type GuessRequest,
    requestGuess,
} from './guessClient.js'

const frames: GuessRequest['frames'] = [
    { timestampMs: 0, mimeType: 'image/jpeg', data: 'AAAA' },
    { timestampMs: 480, mimeType: 'image/jpeg', data: 'BBBB' },
]

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })
}

/** Lê o corpo JSON enviado na enésima chamada ao fetch simulado. */
function sentBodyOf(
    fetchImpl: ReturnType<typeof vi.fn>,
    call = 0,
): Record<string, unknown> {
    const init = fetchImpl.mock.calls[call][1] as RequestInit
    return JSON.parse(init.body as string) as Record<string, unknown>
}

describe('requestGuess', () => {
    it('envia só frames e rejectedGuesses, nunca dados da carta', async () => {
        const fetchImpl = vi
            .fn()
            .mockResolvedValue(
                jsonResponse({
                    guess: 'acenar',
                    durationMs: 1234,
                    providerId: 'mock',
                }),
            )

        const result = await requestGuess(
            { frames, rejectedGuesses: ['levantar a mão'] },
            { fetchImpl },
        )

        expect(result.guess).toBe('acenar')
        expect(result.durationMs).toBe(1234)

        const sentBody = sentBodyOf(fetchImpl)
        expect(sentBody).toEqual({
            frames,
            rejectedGuesses: ['levantar a mão'],
        })
        // Nenhum vazamento de carta no corpo.
        const raw = JSON.stringify(sentBody).toLowerCase()
        for (const forbidden of [
            'word',
            'hint',
            'suggestion',
            'canonical',
            'alias',
            'evaluation',
            'acenar', // a palavra-alvo nunca vai no corpo
        ]) {
            expect(raw).not.toContain(forbidden)
        }
    })

    it('omite rejectedGuesses quando vazio', async () => {
        const fetchImpl = vi
            .fn()
            .mockResolvedValue(
                jsonResponse({ guess: 'x', durationMs: 1, providerId: 'mock' }),
            )
        await requestGuess({ frames, rejectedGuesses: [] }, { fetchImpl })
        const body = sentBodyOf(fetchImpl)
        expect(body).not.toHaveProperty('rejectedGuesses')
    })

    it('propaga erro estável do servidor com código e retryable', async () => {
        const fetchImpl = vi.fn().mockResolvedValue(
            jsonResponse(
                {
                    error: {
                        code: 'provider_timeout',
                        message: 'tempo esgotado no provedor',
                        retryable: true,
                    },
                },
                504,
            ),
        )

        await expect(
            requestGuess({ frames }, { fetchImpl }),
        ).rejects.toMatchObject({
            code: 'provider_timeout',
            retryable: true,
        })
    })

    it('trata payload_too_large como não reexecutável automaticamente', async () => {
        const fetchImpl = vi.fn().mockResolvedValue(
            jsonResponse(
                {
                    error: {
                        code: 'payload_too_large',
                        message: 'grande demais',
                        retryable: false,
                    },
                },
                413,
            ),
        )
        await expect(
            requestGuess({ frames }, { fetchImpl }),
        ).rejects.toMatchObject({ code: 'payload_too_large', retryable: false })
    })

    it('converte falha de rede em network_error reexecutável', async () => {
        const fetchImpl = vi.fn().mockRejectedValue(new TypeError('failed'))
        await expect(
            requestGuess({ frames }, { fetchImpl }),
        ).rejects.toMatchObject({ code: 'network_error', retryable: true })
    })

    it('timeout do cliente vira provider_timeout', async () => {
        // fetch nunca resolve; o timeout interno aborta.
        const fetchImpl = vi.fn(
            (_input: string, init?: RequestInit) =>
                new Promise<Response>((_resolve, reject) => {
                    init?.signal?.addEventListener('abort', () => {
                        const err = new Error('aborted')
                        err.name = 'AbortError'
                        reject(err)
                    })
                }),
        )

        await expect(
            requestGuess({ frames }, { fetchImpl, timeoutMs: 10 }),
        ).rejects.toMatchObject({ code: 'provider_timeout' })
    })

    it('cancelamento externo vira aborted não reexecutável', async () => {
        const controller = new AbortController()
        const fetchImpl = vi.fn(
            (_input: string, init?: RequestInit) =>
                new Promise<Response>((_resolve, reject) => {
                    init?.signal?.addEventListener('abort', () => {
                        const err = new Error('aborted')
                        err.name = 'AbortError'
                        reject(err)
                    })
                }),
        )
        const promise = requestGuess({ frames }, { fetchImpl }, controller.signal)
        controller.abort()
        await expect(promise).rejects.toMatchObject({
            code: 'aborted',
            retryable: false,
        })
    })

    it('GuessApiError expõe code, message e retryable', () => {
        const err = new GuessApiError('provider_error', 'falhou', true)
        expect(err.code).toBe('provider_error')
        expect(err.retryable).toBe(true)
        expect(err.message).toBe('falhou')
    })
})
