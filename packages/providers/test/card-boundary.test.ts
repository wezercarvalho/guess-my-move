import type { GuesserInput } from '@guess-my-move/core'
import { describe, expect, it } from 'vitest'

import {
    captureHaystack,
    findLeak,
    forbiddenCardTerms,
    LeakingGuesserAdapter,
    SpyGuesserProvider,
    wavingCardFixture,
} from './support/card-boundary.js'

// Entrada legítima: só frames e palpites rejeitados genéricos, nunca a carta.
const cleanInput: GuesserInput = {
    frames: [
        { timestampMs: 0, mimeType: 'image/jpeg', data: 'AAAA' },
        { timestampMs: 400, mimeType: 'image/jpeg', data: 'BBBB' },
    ],
    rejectedGuesses: ['levantar os dois braços'],
}

const terms = forbiddenCardTerms(wavingCardFixture)

describe('fronteira de informação no provedor', () => {
    it('o provedor não recebe nenhum dado da carta com entrada legítima', async () => {
        const spy = new SpyGuesserProvider()
        await spy.guess(cleanInput)
        const haystack = captureHaystack([spy.seen.input])
        expect(findLeak(haystack, terms)).toBeNull()
    })

    // Teste "mutante" mantido VERDE: em vez de deixar a suíte vermelha, provamos
    // que o detector de fronteira PEGA um vazamento. O LeakingGuesserAdapter
    // injeta a dica da carta no que chega ao provedor subjacente; o teste passa
    // justamente porque o detector encontra o vazamento. Se o detector deixasse
    // de pegar (findLeak retornasse null), este teste falharia — que é a prova
    // de que o teste de fronteira realmente falha quando um campo vaza.
    it('o detector de fronteira pega um campo da carta injetado (prova do mutante)', async () => {
        const spy = new SpyGuesserProvider()
        const leaking = new LeakingGuesserAdapter(spy, wavingCardFixture)
        await leaking.guess(cleanInput)
        const haystack = captureHaystack([spy.seen.input])
        const leak = findLeak(haystack, terms)
        expect(leak).toBe(wavingCardFixture.public.hint)
    })

    it('todos os termos proibidos da carta são cobertos pelo detector', () => {
        // Cada campo da carta, isolado, é detectado — garante que o conjunto de
        // termos não deixa nenhum campo de fora.
        for (const term of terms) {
            expect(findLeak(term.toLowerCase(), terms)).not.toBeNull()
        }
        expect(terms.length).toBeGreaterThanOrEqual(8)
    })
})
