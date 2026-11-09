import { describe, expect, it } from 'vitest'
import {
    cards,
    getCardById,
    getCards,
    toPublicCard,
    createRound,
    cardMaxDurationMs,
    scoreCardRound,
} from '../src/index.js'

describe('baralho versionado e regras', () => {
    it('oferece categorias/dificuldades e usa o mesmo árbitro para cada carta', () => {
        expect(cards.length).toBeGreaterThanOrEqual(4)
        expect(
            new Set(cards.map((card) => card.public.category)).size,
        ).toBeGreaterThanOrEqual(3)
        expect(
            new Set(cards.map((card) => card.public.difficulty)).size,
        ).toBeGreaterThanOrEqual(2)
        for (const card of cards) {
            let now = 0
            const round = createRound({ card, clock: () => now })
            round.revealCard()
            round.cameraReady()
            round.start()
            const angles = [0, 65, -65, 65, -65, 65, -65, 65, -65]
            for (const angle of angles) {
                now += 150
                round.observe(angle)
            }
            expect(round.state).toBe('recognized')
        }
    })
    it('filtra e traduz sem alterar o critério nem vazar avaliação', () => {
        for (const card of cards) {
            const translated = getCardById(card.id, 'en-US')!
            expect(translated).toBeDefined()
            expect(translated.locale).toBe('en-US')
            expect(translated.public.word).not.toBe(card.public.word)
            expect(translated.evaluation).toEqual(card.evaluation)
            for (const value of [card, translated]) {
                const publicJson = JSON.stringify(toPublicCard(value))
                for (const privateKey of [
                    'evaluation',
                    'criterion',
                    'amplitudeDeg',
                    'minReversals',
                    'basePoints',
                    'maxDurationMs',
                ])
                    expect(publicJson).not.toContain(privateKey)
            }
            expect(
                getCards({
                    category: card.public.category!,
                    difficulty: card.public.difficulty!,
                }).some((value) => value.id === card.id),
            ).toBe(true)
        }
        expect(getCards({ category: 'missing' })).toEqual([])
        expect(getCardById('missing', 'en-US')).toBeUndefined()
    })
    it('define duração e pontuação a partir dos metadados privados', () => {
        const card = cards[0]
        expect(cardMaxDurationMs(card)).toBe(10000)
        expect(scoreCardRound(card, 'recognized', 0)).toBe(
            card.evaluation.basePoints,
        )
        expect(scoreCardRound(card, 'recognized', 5000)).toBe(
            Math.round(card.evaluation.basePoints! * 0.75),
        )
        for (const state of [
            'timed_out',
            'user_cancelled',
            'tracker_error',
        ] as const)
            expect(scoreCardRound(card, state, 5000)).toBe(0)
        expect(scoreCardRound(card, 'recognized', 10000)).toBe(0)
        expect(scoreCardRound(card, 'recognized', -1)).toBe(0)
        expect(scoreCardRound(card, 'recognized', NaN)).toBe(0)
        let now = 0
        const custom = {
            ...card,
            evaluation: { ...card.evaluation, maxDurationMs: 500 },
        }
        const round = createRound({ card: custom, clock: () => now })
        round.revealCard()
        round.cameraReady()
        round.start()
        now = 500
        round.tick()
        expect(round.state).toBe('timed_out')
    })
})
