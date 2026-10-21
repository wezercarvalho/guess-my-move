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

describe('carta — schema e validação (#11)', () => {
    it('expõe public e evaluation da carta Acenar separadamente', () => {
        expect(acenarCard.id).toBe('wave-001')
        expect(acenarCard.locale).toBe('pt-BR')
        expect(acenarCard.public.word).toBe('Acenar')
        expect(acenarCard.public.hint).toMatch(/cumprimentar|despedir/i)
        expect(acenarCard.public.suggestion).toMatch(/mão/i)
        expect(acenarCard.evaluation.canonicalAnswer).toBe('acenar')
    })

    it('segue os aliases e palpites insuficientes do PROJECT_SPEC', () => {
        const aliases = acenarCard.evaluation.acceptedAliases
        expect(aliases).toContain('dar tchau')
        expect(aliases).toContain('acenando')
        expect(aliases).toContain('waving')
        expect(aliases).toContain('waving goodbye')

        const insufficient = acenarCard.evaluation.insufficientGuesses
        expect(insufficient).toContain('levantar a mão')
        expect(insufficient).toContain('mexer o braço')
    })

    it('valida uma carta bem formada e rejeita cartas inválidas', () => {
        const result = validateCard(acenarCard)
        expect(result.ok).toBe(true)

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
        const parsed = parseCard(acenarCard)
        expect(parsed.evaluation.canonicalAnswer).toBe('acenar')
    })

    it('rejeita evaluation com campos ausentes ou de tipo errado', () => {
        const invalid = {
            id: 'wave-002',
            locale: 'pt-BR',
            public: {
                word: 'Pular',
                hint: 'dica',
                suggestion: 'sugestão',
            },
            evaluation: {
                canonicalAnswer: 'pular',
                acceptedAliases: 'não é array',
                insufficientGuesses: [],
            },
        }
        const result = validateCard(invalid)
        expect(result.ok).toBe(false)
    })

    it('getCardById encontra a carta no baralho versionado', () => {
        expect(getCardById('wave-001')).toBe(acenarCard)
        expect(getCardById('inexistente')).toBeUndefined()
        expect(cards.length).toBeGreaterThanOrEqual(1)
    })
})

describe('carta — fronteira de informação (#11)', () => {
    it('toPublicCard nunca inclui evaluation', () => {
        const pub = toPublicCard(acenarCard)
        expect(pub.public.word).toBe('Acenar')
        expect('evaluation' in pub).toBe(false)
        // Nenhum dado de avaliação pode vazar no objeto público serializado.
        const serialized = JSON.stringify(pub)
        expect(serialized).not.toContain('canonicalAnswer')
        expect(serialized).not.toContain('acenar'.toLowerCase())
        expect(serialized).not.toContain('tchau')
        expect(serialized).not.toContain('waving')
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
