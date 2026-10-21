import { describe, expect, it } from 'vitest'

import type { AmbiguityResolver, CardEvaluation } from '../src/index.js'
import { acenarCard, judge, judgeWithFallback } from '../src/index.js'

const evaluation = acenarCard.evaluation

// Avaliação sem palpites insuficientes cadastrados, para forçar um veredito
// determinístico `undetermined` em um palpite ambíguo configurável no teste.
const ambiguousEval: CardEvaluation = {
    canonicalAnswer: 'acenar',
    acceptedAliases: ['dar tchau'],
    insufficientGuesses: [],
    // Marcação de ambiguidade: palpites aqui não casam nem por canônico nem por
    // alias, mas o árbitro determinístico os devolve como `undetermined` para o
    // fallback decidir (ver judge/options).
    ambiguousGuesses: ['gesticular com a mao'],
}

describe('árbitro — fallback por LLM desligado por padrão (#14)', () => {
    it('sem resolver, ambíguo permanece undetermined', async () => {
        const r = await judgeWithFallback(ambiguousEval, 'gesticular com a mao')
        expect(r.isCorrect).toBe(false)
        expect(r.method).toBe('undetermined')
    })

    it('judgeWithFallback sem resolver é equivalente ao judge determinístico', async () => {
        expect((await judgeWithFallback(evaluation, 'dar tchau')).method).toBe(
            'alias',
        )
        expect((await judgeWithFallback(evaluation, 'acenar')).method).toBe(
            'canonical',
        )
        expect(
            (await judgeWithFallback(evaluation, 'levantar a mão')).method,
        ).toBe('insufficient')
    })
})

describe('árbitro — fallback por LLM ligado (#14)', () => {
    it('resolver confiante de acerto marca correto por método llm', async () => {
        const resolver: AmbiguityResolver = {
            resolve: () =>
                Promise.resolve({
                    isCorrect: true,
                    confident: true,
                    reason: 'equivalente à ação-alvo',
                }),
        }
        const r = await judgeWithFallback(
            ambiguousEval,
            'gesticular com a mao',
            { resolver },
        )
        expect(r.isCorrect).toBe(true)
        expect(r.method).toBe('llm')
        expect(r.reason).toBeTruthy()
    })

    it('erro do resolver vira undetermined, nunca acerto inventado', async () => {
        const resolver: AmbiguityResolver = {
            resolve: () => Promise.reject(new Error('provedor indisponível')),
        }
        const r = await judgeWithFallback(
            ambiguousEval,
            'gesticular com a mao',
            { resolver },
        )
        expect(r.isCorrect).toBe(false)
        expect(r.method).toBe('undetermined')
        expect(r.reason).toBeTruthy()
    })

    it('resposta não confiante do resolver vira undetermined', async () => {
        const resolver: AmbiguityResolver = {
            resolve: () =>
                Promise.resolve({ isCorrect: true, confident: false }),
        }
        const r = await judgeWithFallback(
            ambiguousEval,
            'gesticular com a mao',
            { resolver },
        )
        expect(r.isCorrect).toBe(false)
        expect(r.method).toBe('undetermined')
    })

    it('resolver confiante de erro mantém incorreto (undetermined, sem acerto)', async () => {
        const resolver: AmbiguityResolver = {
            resolve: () =>
                Promise.resolve({ isCorrect: false, confident: true }),
        }
        const r = await judgeWithFallback(
            ambiguousEval,
            'gesticular com a mao',
            { resolver },
        )
        expect(r.isCorrect).toBe(false)
    })

    it('NÃO consulta o resolver quando o veredito determinístico já é claro', async () => {
        let called = false
        const resolver: AmbiguityResolver = {
            resolve: () => {
                called = true
                return Promise.resolve({ isCorrect: true, confident: true })
            },
        }
        // "dar tchau" casa por alias deterministicamente: resolver não é chamado.
        const r = await judgeWithFallback(evaluation, 'dar tchau', { resolver })
        expect(r.method).toBe('alias')
        expect(called).toBe(false)
        // "dançar balé" é `none` deterministicamente: também não consulta LLM.
        await judgeWithFallback(evaluation, 'dançar balé', { resolver })
        expect(called).toBe(false)
    })

    it('resolver não recebe nenhum dado da carta além do necessário para arbitrar', async () => {
        let receivedKeys: string[] = []
        const resolver: AmbiguityResolver = {
            resolve: (input) => {
                receivedKeys = Object.keys(input)
                return Promise.resolve({ isCorrect: false, confident: false })
            },
        }
        await judgeWithFallback(ambiguousEval, 'gesticular com a mao', {
            resolver,
        })
        // O resolver arbitra texto, não webcam: recebe guess + dados de
        // avaliação textual, nunca frames.
        expect(receivedKeys).not.toContain('frames')
    })
})

describe('judge determinístico sinaliza ambiguidade (#14)', () => {
    it('palpite em ambiguousGuesses vira undetermined no judge', () => {
        const r = judge(ambiguousEval, 'gesticular com a mao')
        expect(r.method).toBe('undetermined')
    })
})
