import { describe, expect, it, vi } from 'vitest'

import type {
    CapturedFrame,
    GuesserInput,
    GuesserProvider,
    GuesserResult,
} from '../src/index.js'
import { acenarCard, createRound } from '../src/index.js'

const frames: CapturedFrame[] = [
    { timestampMs: 0, mimeType: 'image/jpeg', data: 'AAAA' },
    { timestampMs: 400, mimeType: 'image/jpeg', data: 'BBBB' },
]

/** Provedor de teste que devolve palpites de uma fila, em ordem. */
function queueProvider(
    guesses: Array<GuesserResult | Error>,
    capture?: (input: GuesserInput) => void,
): GuesserProvider {
    let i = 0
    return {
        id: 'queue',
        guess(input) {
            capture?.(input)
            const next = guesses[i++]
            if (next instanceof Error) return Promise.reject(next)
            return Promise.resolve(next)
        },
    }
}

describe('motor da rodada — transições felizes (#12)', () => {
    it('idle → card_revealed → camera_ready → correct no acerto', async () => {
        const provider = queueProvider([{ guess: 'dar tchau' }])
        const round = createRound({
            card: acenarCard,
            provider,
            maxAttempts: 3,
        })
        expect(round.state).toBe('idle')
        round.revealCard()
        expect(round.state).toBe('card_revealed')
        round.cameraReady()
        expect(round.state).toBe('camera_ready')
        const outcome = await round.attempt(frames)
        expect(outcome.isCorrect).toBe(true)
        expect(round.state).toBe('correct')
        expect(round.finished).toBe(true)
    })
})

describe('motor da rodada — nova tentativa sem repetir rejeitados (#12)', () => {
    it('palpite incorreto volta a retry e acumula rejectedGuesses', async () => {
        const seen: GuesserInput[] = []
        const provider = queueProvider(
            [{ guess: 'levantar a mão' }, { guess: 'acenar' }],
            (input) => seen.push(structuredClone(input)),
        )
        const round = createRound({
            card: acenarCard,
            provider,
            maxAttempts: 3,
        })
        round.revealCard()
        round.cameraReady()

        const first = await round.attempt(frames)
        expect(first.isCorrect).toBe(false)
        expect(round.state).toBe('retry')

        const second = await round.attempt(frames)
        expect(second.isCorrect).toBe(true)
        expect(round.state).toBe('correct')

        // Primeira chamada sem rejeitados; segunda carrega o palpite anterior.
        expect(seen[0]?.rejectedGuesses ?? []).toHaveLength(0)
        expect(seen[1]?.rejectedGuesses).toContain('levantar a mão')
    })

    it('não repete o mesmo palpite rejeitado no histórico', async () => {
        const seen: GuesserInput[] = []
        const provider = queueProvider(
            [
                { guess: 'levantar a mão' },
                { guess: 'levantar a mão' },
                { guess: 'acenar' },
            ],
            (input) => seen.push(structuredClone(input)),
        )
        const round = createRound({
            card: acenarCard,
            provider,
            maxAttempts: 5,
        })
        round.revealCard()
        round.cameraReady()
        await round.attempt(frames)
        await round.attempt(frames)
        await round.attempt(frames)
        // Mesmo palpite repetido aparece uma única vez em rejectedGuesses.
        const last = seen[2]?.rejectedGuesses ?? []
        expect(last.filter((g) => g === 'levantar a mão')).toHaveLength(1)
    })
})

describe('motor da rodada — limites (#12)', () => {
    it('termina sem acerto ao esgotar as tentativas', async () => {
        const provider = queueProvider([
            { guess: 'levantar a mão' },
            { guess: 'mexer o braço' },
        ])
        const round = createRound({
            card: acenarCard,
            provider,
            maxAttempts: 2,
        })
        round.revealCard()
        round.cameraReady()
        await round.attempt(frames)
        expect(round.state).toBe('retry')
        const last = await round.attempt(frames)
        expect(last.isCorrect).toBe(false)
        expect(round.state).toBe('finished')
        expect(round.finished).toBe(true)
    })

    it('respeita o limite de tempo por rodada com relógio injetável', async () => {
        let now = 1_000
        const clock = () => now
        const provider = queueProvider([
            { guess: 'levantar a mão' },
            { guess: 'acenar' },
        ])
        const round = createRound({
            card: acenarCard,
            provider,
            maxAttempts: 5,
            maxDurationMs: 5_000,
            clock,
        })
        round.revealCard()
        round.cameraReady()
        await round.attempt(frames)
        expect(round.state).toBe('retry')
        now = 7_000 // tempo esgotou
        const outcome = await round.attempt(frames)
        expect(outcome.isCorrect).toBe(false)
        expect(round.state).toBe('finished')
        expect(outcome.reason).toMatch(/tempo/i)
    })
})

describe('motor da rodada — estados de exceção (#12)', () => {
    it('erro de provedor: estado íntegro, nenhum acerto marcado', async () => {
        const provider = queueProvider([new Error('falha de rede')])
        const round = createRound({
            card: acenarCard,
            provider,
            maxAttempts: 3,
        })
        round.revealCard()
        round.cameraReady()
        const outcome = await round.attempt(frames)
        expect(outcome.isCorrect).toBe(false)
        expect(round.state).toBe('provider_error')
        // Recuperável: pode tentar de novo.
        expect(round.finished).toBe(false)
    })

    it('resposta inválida do modelo → invalid_model_response, sem acerto', async () => {
        const provider = queueProvider([{ guess: '' }])
        const round = createRound({
            card: acenarCard,
            provider,
            maxAttempts: 3,
        })
        round.revealCard()
        round.cameraReady()
        const outcome = await round.attempt(frames)
        expect(outcome.isCorrect).toBe(false)
        expect(round.state).toBe('invalid_model_response')
    })

    it('timeout do provedor → request_timeout, sem acerto', async () => {
        const provider: GuesserProvider = {
            id: 'lento',
            guess: () =>
                new Promise((_resolve, reject) =>
                    setTimeout(() => reject(new Error('timeout')), 50),
                ),
        }
        const round = createRound({
            card: acenarCard,
            provider,
            maxAttempts: 3,
            requestTimeoutMs: 5,
        })
        round.revealCard()
        round.cameraReady()
        const outcome = await round.attempt(frames)
        expect(outcome.isCorrect).toBe(false)
        expect(round.state).toBe('request_timeout')
    })

    it('câmera negada e cancelamento do usuário encerram sem acerto', () => {
        const provider = queueProvider([{ guess: 'acenar' }])
        const denied = createRound({
            card: acenarCard,
            provider,
            maxAttempts: 3,
        })
        denied.revealCard()
        denied.denyCamera()
        expect(denied.state).toBe('camera_denied')

        const cancelled = createRound({
            card: acenarCard,
            provider,
            maxAttempts: 3,
        })
        cancelled.revealCard()
        cancelled.cameraReady()
        cancelled.cancel()
        expect(cancelled.state).toBe('user_cancelled')
        expect(cancelled.finished).toBe(true)
    })

    it('tentar julgar sem câmera pronta é rejeitado (transição inválida)', async () => {
        const provider = queueProvider([{ guess: 'acenar' }])
        const round = createRound({
            card: acenarCard,
            provider,
            maxAttempts: 3,
        })
        await expect(round.attempt(frames)).rejects.toThrow()
    })
})

describe('motor da rodada — histórico e provedor (#12)', () => {
    it('mantém o histórico de tentativas em memória', async () => {
        const provider = queueProvider([
            { guess: 'levantar a mão' },
            { guess: 'acenar' },
        ])
        const round = createRound({
            card: acenarCard,
            provider,
            maxAttempts: 3,
        })
        round.revealCard()
        round.cameraReady()
        await round.attempt(frames)
        await round.attempt(frames)
        expect(round.history).toHaveLength(2)
        expect(round.history[0]?.guess).toBe('levantar a mão')
        expect(round.history[1]?.result.isCorrect).toBe(true)
    })

    it('passa o signal e os frames ao provedor', async () => {
        const spy =
            vi.fn<(input: GuesserInput) => Promise<GuesserResult>>()
        spy.mockResolvedValue({ guess: 'acenar' })
        const provider: GuesserProvider = { id: 'spy', guess: spy }
        const round = createRound({
            card: acenarCard,
            provider,
            maxAttempts: 3,
        })
        round.revealCard()
        round.cameraReady()
        await round.attempt(frames)
        expect(spy).toHaveBeenCalledOnce()
        const input = spy.mock.calls[0]?.[0]
        expect(input?.frames).toEqual(frames)
    })
})
