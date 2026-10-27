import { describe, expect, it } from 'vitest'

import {
    acenarCard,
    cards,
    getCardById,
    isCard,
    parseCard,
    toPublicCard,
    validateCard,
} from '../src/index.js'

describe('carta — schema e validação', () => {
    it('expõe public e o critério de avaliação da carta Acenar', () => {
        expect(acenarCard.id).toBe('wave-001')
        expect(acenarCard.locale).toBe('pt-BR')
        expect(acenarCard.public.word).toBe('Acenar')
        expect(acenarCard.public.hint).toMatch(/cumprimentar|despedir/i)
        expect(acenarCard.public.suggestion).toMatch(/mão/i)
        expect(acenarCard.evaluation.criterion).toEqual({
            kind: 'hand-angle-oscillation',
            amplitudeDeg: 15,
            minReversals: 3,
            windowMs: 2500,
            minSamples: 5,
        })
    })

    it('valida uma carta bem formada e rejeita cartas inválidas', () => {
        expect(validateCard(acenarCard).ok).toBe(true)

        const bad = validateCard({ id: 'x', locale: 'pt-BR' })
        expect(bad.ok).toBe(false)
        if (!bad.ok) {
            expect(bad.errors.length).toBeGreaterThan(0)
        }

        expect(isCard(acenarCard)).toBe(true)
        expect(isCard({})).toBe(false)
    })

    it('parseCard lança em carta inválida e devolve carta tipada em válida', () => {
        expect(() => parseCard({ nope: true })).toThrow()
        expect(parseCard(acenarCard).evaluation.criterion.kind).toBe(
            'hand-angle-oscillation',
        )
    })

    it('getCardById encontra a carta no baralho versionado', () => {
        expect(getCardById('wave-001')).toBe(acenarCard)
        expect(getCardById('inexistente')).toBeUndefined()
        expect(cards.length).toBeGreaterThanOrEqual(1)
    })
})

describe('carta — fronteira de informação', () => {
    it('toPublicCard nunca inclui evaluation nem o critério', () => {
        const pub = toPublicCard(acenarCard)
        expect(pub.public.word).toBe('Acenar')
        expect('evaluation' in pub).toBe(false)
        const serialized = JSON.stringify(pub)
        expect(serialized).not.toContain('criterion')
        expect(serialized).not.toContain('hand-angle-oscillation')
        expect(serialized).not.toContain('amplitudeDeg')
        expect(serialized).not.toContain('minReversals')
    })

    it('toPublicCard preserva id, locale e dados públicos', () => {
        const pub = toPublicCard(acenarCard)
        expect(pub.id).toBe(acenarCard.id)
        expect(pub.locale).toBe(acenarCard.locale)
        expect(pub.public.hint).toBe(acenarCard.public.hint)
        expect(pub.public.suggestion).toBe(acenarCard.public.suggestion)
    })

    it('mutar o resultado público não altera a carta original', () => {
        const pub = toPublicCard(acenarCard)
        pub.public.word = 'Alterado'
        expect(acenarCard.public.word).toBe('Acenar')
    })
})
