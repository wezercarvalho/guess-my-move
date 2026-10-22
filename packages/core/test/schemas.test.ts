import { describe, expect, it } from 'vitest'

import {
    acenarCard,
    apiErrorSchema,
    cardSchema,
    checkGuessLimits,
    guessRequestSchema,
    guessResponseSchema,
    validateCard,
    type GuessLimits,
    type GuesserInput,
} from '../src/index.js'

const frame = (timestampMs: number, data = 'AAAA') => ({
    timestampMs,
    mimeType: 'image/jpeg' as const,
    data,
})

const limits: GuessLimits = {
    maxFrames: 6,
    maxFrameBytes: 1024,
    maxTotalBytes: 4096,
    maxRejectedGuesses: 6,
}

function issues(value: unknown): string[] {
    const result = guessRequestSchema.safeParse(value)
    return result.success
        ? []
        : result.error.issues.map(
              (issue) => `${issue.path.map(String).join('.')}: ${issue.message}`,
          )
}

describe('guessRequestSchema', () => {
    it('aceita frames em ordem e devolve uma cópia tipada', () => {
        const body = {
            frames: [frame(0), frame(400)],
            rejectedGuesses: ['levantar a mão'],
        }
        const result = guessRequestSchema.safeParse(body)
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data).toEqual(body)
            expect(result.data).not.toBe(body)
        }
    })

    it('rejeita corpo que não é objeto', () => {
        expect(issues(null)).not.toEqual([])
        expect(issues('x')).not.toEqual([])
        expect(issues([])).not.toEqual([])
    })

    it('rejeita frames ausente ou vazio', () => {
        expect(issues({})).toEqual(['frames: campo obrigatório'])
        expect(issues({ frames: [] })).toEqual(['frames: frames ausente ou vazio'])
    })

    it('rejeita MIME não permitido e base64 inválido', () => {
        expect(issues({ frames: [{ ...frame(0), mimeType: 'image/gif' }] })).toEqual([
            'frames.0.mimeType: valor não permitido',
        ])
        expect(issues({ frames: [{ ...frame(0), data: 'não base64!' }] })).toEqual([
            'frames.0.data: não é base64 válido',
        ])
        expect(issues({ frames: [{ ...frame(0), data: '' }] })).toContain(
            'frames.0.data: frame sem dados',
        )
    })

    it('rejeita timestamps fora de ordem', () => {
        expect(issues({ frames: [frame(400), frame(0)] })).toEqual([
            'frames.1.timestampMs: timestamps dos frames fora de ordem crescente',
        ])
    })

    it('rejeita rejectedGuesses que não é lista de textos', () => {
        expect(issues({ frames: [frame(0)], rejectedGuesses: 'x' })).not.toEqual([])
        expect(issues({ frames: [frame(0)], rejectedGuesses: [1] })).not.toEqual([])
    })

    it('rejeita qualquer campo extra, inclusive dados da carta', () => {
        expect(
            issues({ frames: [frame(0)], card: { word: 'acenar' } }),
        ).toEqual([': campos não permitidos: card'])
        expect(
            issues({ frames: [{ ...frame(0), hint: 'dica da carta' }] }),
        ).toEqual(['frames.0: campos não permitidos: hint'])
    })
})

describe('checkGuessLimits', () => {
    const valid = (
        frames: ReturnType<typeof frame>[],
        rejected?: string[],
    ): GuesserInput => ({
        frames,
        ...(rejected ? { rejectedGuesses: rejected } : {}),
    })

    it('aceita uma requisição dentro dos limites', () => {
        expect(checkGuessLimits(valid([frame(0), frame(400)]), limits)).toBeNull()
    })

    it('recusa frames demais com payload_too_large', () => {
        const frames = Array.from({ length: 7 }, (_, i) => frame(i * 100))
        expect(checkGuessLimits(valid(frames), limits)?.code).toBe('payload_too_large')
    })

    it('recusa frame acima do limite de bytes', () => {
        expect(
            checkGuessLimits(valid([frame(0, 'A'.repeat(4000))]), limits)?.code,
        ).toBe('payload_too_large')
    })

    it('recusa total acima do limite', () => {
        const chunk = 'A'.repeat(1000)
        const frames = Array.from({ length: 6 }, (_, i) => frame(i, chunk))
        expect(checkGuessLimits(valid(frames), limits)?.code).toBe('payload_too_large')
    })

    it('recusa rejectedGuesses acima do limite com invalid_payload', () => {
        const rejected = Array.from({ length: 7 }, () => 'x')
        expect(checkGuessLimits(valid([frame(0)], rejected), limits)?.code).toBe(
            'invalid_payload',
        )
    })

    it('não ecoa o conteúdo dos frames na mensagem', () => {
        const violation = checkGuessLimits(valid([frame(0, 'A'.repeat(4000))]), limits)
        expect(violation?.message).not.toContain('AAAA')
    })
})

describe('guessResponseSchema e apiErrorSchema', () => {
    it('valida a resposta de sucesso e recusa campos extras', () => {
        const ok = { guess: 'acenar', durationMs: 12, providerId: 'mock' }
        expect(guessResponseSchema.safeParse(ok).success).toBe(true)
        expect(guessResponseSchema.safeParse({ ...ok, extra: 1 }).success).toBe(false)
        expect(guessResponseSchema.safeParse({ guess: 'x' }).success).toBe(false)
    })

    it('valida o formato estável de erro', () => {
        const error = {
            error: { code: 'rate_limited', message: 'calma', retryable: true },
        }
        expect(apiErrorSchema.safeParse(error).success).toBe(true)
        expect(
            apiErrorSchema.safeParse({ error: { ...error.error, code: 'outro' } }).success,
        ).toBe(false)
    })
})

describe('cardSchema', () => {
    it('aceita a carta Acenar e recusa campo extra em public e evaluation', () => {
        expect(cardSchema.safeParse(acenarCard).success).toBe(true)
        const withExtra = {
            ...acenarCard,
            public: { ...acenarCard.public, secret: 'x' },
        }
        expect(validateCard(withExtra)).toEqual({
            ok: false,
            errors: ['public: campos não permitidos: secret'],
        })
    })

    it('recusa texto só com espaços e reporta o caminho do campo', () => {
        const blank = { ...acenarCard, public: { ...acenarCard.public, word: '   ' } }
        expect(validateCard(blank)).toEqual({
            ok: false,
            errors: ['public.word: não pode ser vazio'],
        })
    })

    it('reporta carta que não é objeto', () => {
        expect(validateCard(null)).toEqual({
            ok: false,
            errors: ['carta: deve ser um objeto'],
        })
    })
})
