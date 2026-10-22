import { describe, expect, it } from 'vitest'

import { describeActiveProvider } from '../src/config/active-provider.js'

function config(values: Record<string, string | undefined>) {
    return { get: (key: string) => values[key] } as never
}

describe('describeActiveProvider', () => {
    it('avisa que o mock é um palpite fixo', () => {
        expect(describeActiveProvider(config({ GUESSER_PROVIDER: 'mock' }))).toBe(
            'Provedor ativo: mock (palpite fixo "acenar", sem modelo real)',
        )
    })

    it('mostra modelo e esforço no codex', () => {
        expect(
            describeActiveProvider(
                config({
                    GUESSER_PROVIDER: 'codex',
                    CODEX_MODEL: 'gpt-6-luna',
                    CODEX_REASONING_EFFORT: 'low',
                }),
            ),
        ).toBe('Provedor ativo: codex (modelo gpt-6-luna, esforço low)')
    })

    it('não imprime credenciais nem o caminho do executável', () => {
        const text = describeActiveProvider(
            config({
                GUESSER_PROVIDER: 'codex',
                CODEX_MODEL: 'm',
                CODEX_BIN: '/home/x/.local/bin/codex',
                OPENAI_API_KEY: 'sk-secret',
            }),
        )
        expect(text).not.toContain('sk-secret')
        expect(text).not.toContain('/home/x')
    })
})
