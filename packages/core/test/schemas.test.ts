import { describe, expect, it } from 'vitest'

import { acenarCard, cardSchema, validateCard } from '../src/index.js'

const criterion = {
    kind: 'hand-angle-oscillation',
    amplitudeDeg: 15,
    minReversals: 3,
    windowMs: 2500,
    minSamples: 5,
}

const cardWith = (overrides: Record<string, unknown>) => ({
    id: 'wave-002',
    locale: 'pt-BR',
    public: { word: 'Acenar', hint: 'dica', suggestion: 'sugestão' },
    evaluation: { criterion: { ...criterion, ...overrides } },
})

function errors(value: unknown): string[] {
    const result = validateCard(value)
    return result.ok ? [] : result.errors
}

describe('cardSchema — critério hand-angle-oscillation', () => {
    it('aceita o critério do Acenar e devolve uma cópia tipada', () => {
        const result = cardSchema.safeParse(cardWith({}))
        expect(result.success).toBe(true)
        expect(validateCard(acenarCard).ok).toBe(true)
    })

    it('rejeita um tipo de critério desconhecido', () => {
        expect(errors(cardWith({ kind: 'text-guess' }))).toEqual([
            'evaluation.criterion.kind: valor não permitido',
        ])
    })

    it.each(['amplitudeDeg', 'minReversals', 'windowMs', 'minSamples'])(
        'rejeita %s ausente',
        (field) => {
            const card = cardWith({})
            delete (card.evaluation.criterion as Record<string, unknown>)[field]
            expect(errors(card)).toEqual([
                `evaluation.criterion.${field}: campo obrigatório`,
            ])
        },
    )

    it.each(['amplitudeDeg', 'minReversals', 'windowMs', 'minSamples'])(
        'rejeita %s zero ou negativo',
        (field) => {
            expect(errors(cardWith({ [field]: 0 }))).not.toEqual([])
            expect(errors(cardWith({ [field]: -1 }))).not.toEqual([])
        },
    )

    it('rejeita contagens fracionárias', () => {
        expect(errors(cardWith({ minReversals: 2.5 }))).not.toEqual([])
        expect(errors(cardWith({ minSamples: 1.5 }))).not.toEqual([])
    })

    it('rejeita campos desconhecidos no critério e na avaliação', () => {
        expect(errors(cardWith({ extra: 1 }))).toEqual([
            'evaluation.criterion: campos não permitidos: extra',
        ])
        const withExtra = cardWith({})
        Object.assign(withExtra.evaluation, { canonicalAnswer: 'acenar' })
        expect(errors(withExtra)).toEqual([
            'evaluation: campos não permitidos: canonicalAnswer',
        ])
    })

    it('rejeita critério ausente', () => {
        const card = { ...cardWith({}), evaluation: {} }
        expect(errors(card)).toEqual(['evaluation.criterion: campo obrigatório'])
    })
})
