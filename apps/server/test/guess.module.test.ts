import type { GuesserInput } from '@guess-my-move/core'
import type { ConfigService } from '@nestjs/config'
import {
    CodexGuesserProvider,
    MockGuesserProvider,
} from '@guess-my-move/providers'
import { describe, expect, it } from 'vitest'

import type { EnvironmentVariables } from '../src/config/environment.js'
import { buildGuesserRegistry } from '../src/guess/guess.module.js'

const base: Record<string, unknown> = {
    REQUEST_TIMEOUT_MS: 15000,
    RATE_LIMIT_PER_MINUTE: 20,
    COST_CEILING_ATTEMPTS_PER_HOUR: 60,
    MAX_FRAMES: 6,
    MAX_FRAME_BYTES: 262144,
    MAX_TOTAL_BYTES: 1572864,
}

function config(env: Record<string, unknown>) {
    return {
        get: (key: string) => env[key],
    } as unknown as ConfigService<EnvironmentVariables, true>
}

describe('buildGuesserRegistry — seleção de provedor por configuração', () => {
    it('modo mock registra só o mock', () => {
        const registry = buildGuesserRegistry(
            config({ ...base, GUESSER_PROVIDER: 'mock' }),
        )
        expect(registry.has('mock')).toBe(true)
        expect(registry.has('codex')).toBe(false)
        expect(registry.create('mock')).toBeInstanceOf(MockGuesserProvider)
    })

    it('modo codex registra o adaptador codex (trocar é só configuração)', () => {
        const registry = buildGuesserRegistry(
            config({
                ...base,
                GUESSER_PROVIDER: 'codex',
                CODEX_MODEL: 'gpt-6-luna',
                CODEX_REASONING_EFFORT: 'low',
            }),
        )
        expect(registry.has('codex')).toBe(true)
        expect(registry.create('codex')).toBeInstanceOf(CodexGuesserProvider)
    })

    it('MOCK_GUESSES configura a sequência de palpites do mock', async () => {
        const registry = buildGuesserRegistry(
            config({
                ...base,
                GUESSER_PROVIDER: 'mock',
                MOCK_GUESSES: ' dançar, pular ,, acenar ',
            }),
        )
        const input: GuesserInput = {
            frames: [{ timestampMs: 0, mimeType: 'image/jpeg', data: 'AAAA' }],
        }
        const mock = registry.create('mock')
        expect(await mock.guess(input)).toEqual({ guess: 'dançar' })
        expect(
            await mock.guess({ ...input, rejectedGuesses: ['dançar', 'pular'] }),
        ).toEqual({ guess: 'acenar' })
    })

    it('sem MOCK_GUESSES o mock mantém o palpite padrão', async () => {
        const registry = buildGuesserRegistry(
            config({ ...base, GUESSER_PROVIDER: 'mock', MOCK_GUESSES: '  ' }),
        )
        const result = await registry.create('mock').guess({
            frames: [{ timestampMs: 0, mimeType: 'image/jpeg', data: 'AAAA' }],
        })
        expect(result).toEqual({ guess: 'acenar' })
    })

    it('codex sem CODEX_MODEL falha de forma explícita', () => {
        expect(() =>
            buildGuesserRegistry(
                config({ ...base, GUESSER_PROVIDER: 'codex' }),
            ),
        ).toThrow(/CODEX_MODEL/)
    })
})
