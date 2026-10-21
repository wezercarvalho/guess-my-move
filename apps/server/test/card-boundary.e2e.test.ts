import type {
    Card,
    GuesserInput,
    GuesserProvider,
    GuesserResult,
} from '@guess-my-move/core'
import { ConfigService } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import { GuesserProviderRegistry } from '@guess-my-move/providers'
import { beforeEach, describe, expect, it } from 'vitest'

import { GuessController } from '../src/guess/guess.controller.js'
import { GUESSER_REGISTRY, GuessService } from '../src/guess/guess.service.js'
import { GuessMetricsLogger } from '../src/guess/metrics.js'

// A carta "Acenar" está VISÍVEL para o teste (como estaria na tela do jogador),
// mas NUNCA é passada à rota: a rota recebe apenas frames e palpites
// rejeitados. Fixture local; a carta oficial vem do agente do core.
const wavingCard: Card = {
    id: 'wave-001',
    locale: 'pt-BR',
    public: {
        word: 'Acenar',
        hint: 'Um gesto de cumprimento à distância.',
        suggestion: 'Levante a mão aberta e balance de lado a lado.',
        difficulty: 'fácil',
    },
    evaluation: {
        canonicalAnswer: 'acenar',
        acceptedAliases: ['dar tchau', 'acenar com a mão'],
        insufficientGuesses: ['levantar a mão'],
        visualCriteria: ['oscilação lateral do pulso'],
    },
}

function forbiddenTerms(card: Card): string[] {
    return [
        card.public.word,
        card.public.hint,
        card.public.suggestion,
        card.public.difficulty ?? '',
        card.evaluation.canonicalAnswer,
        ...card.evaluation.acceptedAliases,
        ...card.evaluation.insufficientGuesses,
        ...(card.evaluation.visualCriteria ?? []),
    ].filter((t) => t.length > 0)
}

function findLeak(haystack: string, terms: string[]): string | null {
    const hay = haystack.toLowerCase()
    for (const term of terms) {
        if (hay.includes(term.toLowerCase())) {
            return term
        }
    }
    return null
}

/** Espião que captura tudo que chega ao provedor pela rota real. */
class RouteSpyProvider implements GuesserProvider {
    readonly id = 'mock'
    seen: GuesserInput | undefined

    guess(input: GuesserInput): Promise<GuesserResult> {
        this.seen = input
        return Promise.resolve({ guess: 'acenar' })
    }
}

const env: Record<string, unknown> = {
    GUESSER_PROVIDER: 'mock',
    REQUEST_TIMEOUT_MS: 15000,
    RATE_LIMIT_PER_MINUTE: 100,
    COST_CEILING_ATTEMPTS_PER_HOUR: 100,
    MAX_FRAMES: 6,
    MAX_FRAME_BYTES: 262144,
    MAX_TOTAL_BYTES: 1572864,
}

async function buildController(spy: RouteSpyProvider): Promise<GuessController> {
    const moduleRef = await Test.createTestingModule({
        controllers: [GuessController],
        providers: [
            GuessService,
            GuessMetricsLogger,
            {
                provide: ConfigService,
                useValue: { get: (key: string) => env[key] },
            },
            {
                provide: GUESSER_REGISTRY,
                useFactory: () =>
                    new GuesserProviderRegistry().register('mock', () => spy),
            },
        ],
    }).compile()
    return moduleRef.get(GuessController)
}

const terms = forbiddenTerms(wavingCard)

const payload = {
    frames: [
        { timestampMs: 0, mimeType: 'image/jpeg', data: 'AAAA' },
        { timestampMs: 400, mimeType: 'image/jpeg', data: 'BBBB' },
    ],
    rejectedGuesses: ['levantar os dois braços'],
}

describe('fronteira de informação na rota /api/guess', () => {
    let spy: RouteSpyProvider

    beforeEach(() => {
        spy = new RouteSpyProvider()
    })

    it('nenhum dado da carta chega ao provedor pela rota completa', async () => {
        const controller = await buildController(spy)
        await controller.guess(payload)
        const haystack = JSON.stringify(spy.seen)
        expect(findLeak(haystack, terms)).toBeNull()
    })

    it('o conjunto de termos cobre palavra, dica, sugestão, canônico, aliases, insuficientes e critérios', () => {
        expect(terms).toContain('Acenar')
        expect(terms).toContain(wavingCard.public.hint)
        expect(terms).toContain(wavingCard.evaluation.canonicalAnswer)
        expect(terms).toContain(wavingCard.evaluation.acceptedAliases[0])
        expect(terms).toContain(wavingCard.evaluation.insufficientGuesses[0])
        expect(terms).toContain(wavingCard.evaluation.visualCriteria?.[0])
    })

    // Prova do mutante (mantida verde): se um campo da carta for injetado no
    // payload, o detector precisa pegá-lo. Simulamos a injeção construindo o
    // haystack com a dica e confirmando que o detector falha a fronteira.
    it('o detector falha quando um campo da carta entra no payload', async () => {
        const controller = await buildController(spy)
        await controller.guess({
            ...payload,
            // Payload mutante: injeta a dica da carta como palpite rejeitado.
            rejectedGuesses: [wavingCard.public.hint],
        })
        const haystack = JSON.stringify(spy.seen)
        expect(findLeak(haystack, terms)).toBe(wavingCard.public.hint)
    })
})
