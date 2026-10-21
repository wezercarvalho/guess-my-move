import type { GuesserInput } from '@guess-my-move/core'
import { describe, expect, it } from 'vitest'

import { MockGuesserProvider, MockProviderError } from '../src/mock-provider.js'

const input: GuesserInput = {
    frames: [{ timestampMs: 0, mimeType: 'image/jpeg', data: 'AAAA' }],
}

describe('MockGuesserProvider', () => {
    it('devolve um palpite determinístico sem credencial', async () => {
        const provider = new MockGuesserProvider()
        const result = await provider.guess(input)
        expect(provider.id).toBe('mock')
        expect(result).toEqual({ guess: 'acenar' })
    })

    it('respeita um palpite configurado', async () => {
        const provider = new MockGuesserProvider({ guess: 'dar tchau' })
        expect(await provider.guess(input)).toEqual({ guess: 'dar tchau' })
    })

    it('pode sinalizar evidência insuficiente', async () => {
        const provider = new MockGuesserProvider({
            insufficientEvidence: true,
        })
        const result = await provider.guess(input)
        expect(result.insufficientEvidence).toBe(true)
    })

    it('rejeita com o erro configurado', async () => {
        const provider = new MockGuesserProvider({
            error: new MockProviderError(),
        })
        await expect(provider.guess(input)).rejects.toBeInstanceOf(
            MockProviderError,
        )
    })

    it('respeita o AbortSignal durante o atraso configurado', async () => {
        const provider = new MockGuesserProvider({ delayMs: 10_000 })
        const controller = new AbortController()
        const pending = provider.guess(input, controller.signal)
        controller.abort()
        await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    })

    it('rejeita imediatamente quando o sinal já está abortado', async () => {
        const provider = new MockGuesserProvider()
        const controller = new AbortController()
        controller.abort()
        await expect(
            provider.guess(input, controller.signal),
        ).rejects.toMatchObject({ name: 'AbortError' })
    })
})
