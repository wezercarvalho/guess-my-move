import { describe, expect, it } from 'vitest'

import type {
    ApiError,
    Card,
    CapturedFrame,
    GuesserInput,
    GuesserResult,
} from '../src/index.js'

describe('contratos do core', () => {
    it('compõe um CapturedFrame e um GuesserInput sem dados da carta', () => {
        const frame: CapturedFrame = {
            timestampMs: 0,
            mimeType: 'image/jpeg',
            data: 'AAAA',
        }
        const input: GuesserInput = { frames: [frame] }
        expect(input.frames).toHaveLength(1)
        expect('word' in input).toBe(false)
    })

    it('mantém word/hint/suggestion no público e o canônico na avaliação', () => {
        const card: Card = {
            id: 'wave-001',
            locale: 'pt-BR',
            public: {
                word: 'Acenar',
                hint: 'Um gesto de cumprimento.',
                suggestion: 'Levante a mão e mova de lado a lado.',
            },
            evaluation: {
                canonicalAnswer: 'acenar',
                acceptedAliases: ['dar tchau'],
                insufficientGuesses: ['levantar a mão'],
            },
        }
        expect(card.public.word).toBe('Acenar')
        expect(card.evaluation.canonicalAnswer).toBe('acenar')
    })

    it('tem resultado com palpite e erro com código estável', () => {
        const result: GuesserResult = { guess: 'dar tchau' }
        const error: ApiError = {
            error: {
                code: 'provider_timeout',
                message: 'tempo esgotado',
                retryable: true,
            },
        }
        expect(result.guess).toBe('dar tchau')
        expect(error.error.code).toBe('provider_timeout')
    })
})
