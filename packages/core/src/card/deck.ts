/** Versioned data, using the same oscillation referee for every card. */
import type { Card } from '../contracts.js'
import { acenarCard } from './acenar.js'
import { parseCard } from './schema.js'

export const CARD_LOCALES = ['pt-BR', 'en-US'] as const
export type CardLocale = (typeof CARD_LOCALES)[number]

function oscillationCard(
    id: string,
    category: string,
    difficulty: string,
    word: string,
    hint: string,
    suggestion: string,
    amplitudeDeg: number,
    minReversals: number,
    basePoints: number,
): Card {
    return parseCard({
        id,
        locale: 'pt-BR',
        public: { word, hint, suggestion, category, difficulty },
        evaluation: {
            basePoints,
            maxDurationMs: 10000,
            criterion: {
                kind: 'hand-angle-oscillation',
                amplitudeDeg,
                minReversals,
                windowMs: 3500,
                minSamples: 5,
            },
        },
    })
}

/** New cards are data: they do not claim semantic classification of the mime. */
export const cards: readonly Card[] = Object.freeze([
    acenarCard,
    oscillationCard(
        'farewell-001',
        'greetings',
        'medium',
        'Despedida animada',
        'A viagem vai começar e você quer se despedir.',
        'Acene com movimentos amplos e repetidos da mão.',
        25,
        5,
        200,
    ),
    oscillationCard(
        'wiper-001',
        'everyday',
        'easy',
        'Limpador de para-brisa',
        'Na chuva, ele limpa o vidro de um lado para o outro.',
        'Imite o movimento do limpador inclinando a mão de um lado para o outro.',
        20,
        3,
        100,
    ),
    oscillationCard(
        'conductor-001',
        'arts',
        'medium',
        'Regente de orquestra',
        'Uma pessoa conduz o ritmo dos músicos.',
        'Marque o ritmo alternando a inclinação da mão várias vezes.',
        20,
        5,
        200,
    ),
])

const english: Partial<Record<string, [string, string, string]>> = {
    'wave-001': [
        'Wave',
        'A gesture to greet someone at a distance.',
        'Raise one hand and move it from side to side.',
    ],
    'farewell-001': [
        'Enthusiastic goodbye',
        'The journey is starting and you want to say goodbye.',
        'Wave with broad, repeated hand movements.',
    ],
    'wiper-001': [
        'Windshield wiper',
        'In the rain, it clears the glass from side to side.',
        'Imitate a wiper by tilting your hand from side to side.',
    ],
    'conductor-001': [
        'Orchestra conductor',
        'Someone guides the rhythm of the musicians.',
        'Mark the rhythm by tilting your hand back and forth several times.',
    ],
}
const translated: readonly Card[] = Object.freeze(
    cards.map((card) => {
        const texts = english[card.id]
        if (!texts) return card // A newly added card keeps its source locale until translated.
        const [word, hint, suggestion] = texts
        return parseCard({
            ...card,
            locale: 'en-US',
            public: { ...card.public, word, hint, suggestion },
        })
    }),
)

export function getCardById(
    id: string,
    locale: CardLocale = 'pt-BR',
): Card | undefined {
    return (locale === 'en-US' ? translated : cards).find(
        (card) => card.id === id,
    )
}

export function getCards(
    filters: {
        locale?: CardLocale
        category?: string
        difficulty?: string
    } = {},
): readonly Card[] {
    return (filters.locale === 'en-US' ? translated : cards).filter(
        (card) =>
            (filters.category === undefined ||
                card.public.category === filters.category) &&
            (filters.difficulty === undefined ||
                card.public.difficulty === filters.difficulty),
    )
}
