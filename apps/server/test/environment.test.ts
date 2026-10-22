import { describe, expect, it } from 'vitest'

import { environmentSchema } from '../src/config/environment.js'

describe('environmentSchema', () => {
    it('aplica os padrões quando nada é definido', () => {
        const env = environmentSchema.parse({})
        expect(env).toMatchObject({
            PORT: 3000,
            GUESSER_PROVIDER: 'mock',
            MAX_FRAMES: 6,
            MAX_FRAME_BYTES: 262144,
            MAX_TOTAL_BYTES: 1572864,
            REQUEST_TIMEOUT_MS: 15000,
            RATE_LIMIT_PER_MINUTE: 20,
            COST_CEILING_ATTEMPTS_PER_HOUR: 60,
        })
    })

    it('converte números vindos como texto e trata vazio como ausente', () => {
        const env = environmentSchema.parse({
            PORT: '4000',
            MAX_FRAMES: '',
            GUESSER_PROVIDER: 'codex',
            CODEX_MODEL: 'gpt-6-luna',
        })
        expect(env.PORT).toBe(4000)
        expect(env.MAX_FRAMES).toBe(6)
        expect(env.GUESSER_PROVIDER).toBe('codex')
        expect(env.CODEX_MODEL).toBe('gpt-6-luna')
    })

    it.each([
        ['PORT', 'abc'],
        ['PORT', '0'],
        ['MAX_FRAMES', '-1'],
        ['MAX_TOTAL_BYTES', '1.5'],
        ['GUESSER_PROVIDER', 'bedrock'],
    ])('recusa %s=%s', (key, value) => {
        expect(environmentSchema.safeParse({ [key]: value }).success).toBe(false)
    })

    it('ignora variáveis desconhecidas do ambiente', () => {
        expect(environmentSchema.safeParse({ PATH: '/usr/bin' }).success).toBe(true)
    })
})
