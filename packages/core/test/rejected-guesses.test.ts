import { describe, expect, it } from 'vitest'

import type {
    CapturedFrame,
    GuesserInput,
    GuesserProvider,
    GuesserResult,
} from '../src/index.js'
import { acenarCard, createRound, RejectedGuesses } from '../src/index.js'

describe('RejectedGuesses — histórico em memória (#15)', () => {
    it('acumula só palpites do modelo, deduplicados e normalizados', () => {
        const rejected = new RejectedGuesses()
        rejected.add('Levantar a Mão')
        rejected.add('levantar a mão') // duplicado por normalização
        rejected.add('mexer o braço')
        expect(rejected.size).toBe(2)
        expect(rejected.toArray()).toEqual(['Levantar a Mão', 'mexer o braço'])
        expect(rejected.has('LEVANTAR A MÃO')).toBe(true)
        expect(rejected.has('acenar')).toBe(false)
    })

    it('ignora palpites vazios ou só com pontuação', () => {
        const rejected = new RejectedGuesses()
        rejected.add('')
        rejected.add('   ')
        rejected.add('!?.')
        expect(rejected.size).toBe(0)
    })

    it('clear() descarta o histórico (sem persistência)', () => {
        const rejected = new RejectedGuesses()
        rejected.add('levantar a mão')
        rejected.clear()
        expect(rejected.size).toBe(0)
        expect(rejected.toArray()).toEqual([])
    })

    it('toArray devolve uma cópia (mutar não afeta o histórico)', () => {
        const rejected = new RejectedGuesses()
        rejected.add('levantar a mão')
        const arr = rejected.toArray()
        arr.push('intruso')
        expect(rejected.size).toBe(1)
    })
})

const frames: CapturedFrame[] = [
    { timestampMs: 0, mimeType: 'image/jpeg', data: 'AAAA' },
]

describe('fronteira: nenhum dado da carta no GuesserInput do motor (#15)', () => {
    it('o input montado pelo motor contém só frames + rejectedGuesses', async () => {
        const seen: GuesserInput[] = []
        const guesses: GuesserResult[] = [
            { guess: 'levantar a mão' },
            { guess: 'acenar' },
        ]
        let i = 0
        const provider: GuesserProvider = {
            id: 'inspect',
            guess(input) {
                seen.push(structuredClone(input))
                const next = guesses[i++]
                if (next === undefined) throw new Error('fila esgotada')
                return Promise.resolve(next)
            },
        }
        const round = createRound({
            card: acenarCard,
            provider,
            maxAttempts: 3,
        })
        round.revealCard()
        round.cameraReady()
        await round.attempt(frames)
        await round.attempt(frames)

        // Reúne todos os termos secretos da carta.
        const secrets = [
            acenarCard.public.word,
            acenarCard.public.hint,
            acenarCard.public.suggestion,
            acenarCard.evaluation.canonicalAnswer,
            ...acenarCard.evaluation.acceptedAliases,
            ...acenarCard.evaluation.insufficientGuesses,
            ...(acenarCard.evaluation.visualCriteria ?? []),
        ].map((s) => s.toLowerCase())

        for (const input of seen) {
            // A entrada só pode ter as chaves do contrato do adivinhador.
            expect(Object.keys(input).sort()).toEqual(
                input.rejectedGuesses === undefined
                    ? ['frames']
                    : ['frames', 'rejectedGuesses'],
            )
            const serialized = JSON.stringify({
                frames: input.frames.map((f) => ({
                    timestampMs: f.timestampMs,
                    mimeType: f.mimeType,
                })),
                rejectedGuesses: input.rejectedGuesses,
            }).toLowerCase()
            for (const secret of secrets) {
                // 'acenar' só poderia aparecer se vazasse a resposta; os
                // rejeitados são palpites do modelo (levantar a mão), não da carta.
                if (secret === 'levantar a mão') continue
                expect(serialized).not.toContain(secret)
            }
        }

        // rejectedGuesses carrega o palpite do modelo, nunca um dado da carta.
        expect(seen[1]?.rejectedGuesses).toEqual(['levantar a mão'])
    })
})
