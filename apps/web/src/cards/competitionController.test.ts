import {
    getCardById,
    toPublicCard,
    type CardRoundAccess,
    type CardRoundSnapshot,
} from '@guess-my-move/core'
import { describe, expect, it, vi } from 'vitest'
import { CompetitionController } from './competitionController.js'
import type { CardRoundApi } from './roundApi.js'

function access(): CardRoundAccess {
    return {
        roundId: 'c9a220bf-5c7d-40fc-b380-fc00d84f2732',
        token: 'x'.repeat(32),
        round: {
            card: toPublicCard(getCardById('wave-001')!),
            state: 'detecting',
            elapsedMs: 0,
            maxDurationMs: 10000,
            score: 0,
        },
    }
}
function harness(api: CardRoundApi) {
    let time = 0
    let callback: (() => void) | undefined
    const close = vi.fn()
    const tracker = {
        delegate: 'CPU' as const,
        detect: vi.fn(() => null),
        close,
    }
    const controller = new CompetitionController({
        cardId: 'wave-001',
        locale: 'pt-BR',
        api,
        env: {
            now: () => time,
            createTracker: () => Promise.resolve(tracker),
            requestFrame: (fn) => {
                callback = fn
                return 1
            },
            cancelFrame: () => {
                callback = undefined
            },
        },
    })
    const video = document.createElement('video')
    Object.defineProperties(video, {
        readyState: { value: 4 },
        videoWidth: { value: 640 },
        videoHeight: { value: 480 },
        currentTime: { get: () => time / 1000 },
    })
    controller.attach({ getVideo: () => video, getOverlay: () => null })
    controller.setCamera(true)
    return {
        controller,
        tracker,
        close,
        step() {
            time += 150
            const fn = callback
            callback = undefined
            fn?.()
        },
    }
}

describe('controlador competitivo', () => {
    it('usa resultado remoto, inclusive timeout sem mão, sem inventar pontos locais', async () => {
        const started = access()
        const final: CardRoundSnapshot = {
            ...started.round,
            state: 'timed_out',
            elapsedMs: 10000,
            score: 0,
        }
        const api: CardRoundApi = {
            start: vi.fn(() => Promise.resolve(started)),
            observe: vi.fn(() => Promise.resolve(final)),
            cancel: vi.fn(() => Promise.resolve(final)),
        }
        const h = harness(api)
        await vi.waitFor(() =>
            expect(h.controller.getSnapshot().canStart).toBe(true),
        )
        await h.controller.start()
        h.step()
        await vi.waitFor(() =>
            expect(h.controller.getSnapshot().status).toBe('finished'),
        )
        expect(h.controller.getSnapshot().round).toEqual(final)
        expect(api.observe).toHaveBeenCalledWith(
            started,
            { seq: 1, angleDeg: null },
            expect.any(AbortSignal),
        )
        h.controller.destroy()
        expect(h.close).toHaveBeenCalledTimes(1)
    })
    it('cancela início pendente e encerra a rodada criada tardiamente sem ressuscitar UI', async () => {
        let deliver!: (value: CardRoundAccess) => void
        const started = access()
        const api: CardRoundApi = {
            start: vi.fn(
                () =>
                    new Promise<CardRoundAccess>((resolve) => {
                        deliver = resolve
                    }),
            ),
            observe: vi.fn(),
            cancel: vi.fn(() =>
                Promise.resolve({
                    ...started.round,
                    state: 'user_cancelled' as const,
                    score: 0,
                }),
            ),
        }
        const h = harness(api)
        await vi.waitFor(() =>
            expect(h.controller.getSnapshot().canStart).toBe(true),
        )
        const pending = h.controller.start()
        h.controller.cancel()
        deliver(started)
        await pending
        expect(h.controller.getSnapshot().status).toBe('cancelled')
        expect(h.controller.getSnapshot().round).toBeNull()
        expect(api.cancel).toHaveBeenCalledOnce()
        expect(api.observe).not.toHaveBeenCalled()
        h.controller.destroy()
    })
    it('ignora observação tardia após sair e fecha detector carregado após descarte', async () => {
        const started = access()
        let deliver!: (value: CardRoundSnapshot) => void
        const api: CardRoundApi = {
            start: vi.fn(() => Promise.resolve(started)),
            observe: vi.fn(
                () =>
                    new Promise<CardRoundSnapshot>((resolve) => {
                        deliver = resolve
                    }),
            ),
            cancel: vi.fn(() =>
                Promise.resolve({
                    ...started.round,
                    state: 'user_cancelled' as const,
                    score: 0,
                }),
            ),
        }
        const h = harness(api)
        await vi.waitFor(() =>
            expect(h.controller.getSnapshot().canStart).toBe(true),
        )
        await h.controller.start()
        h.step()
        h.controller.destroy()
        deliver({ ...started.round, state: 'recognized', score: 99 })
        await Promise.resolve()
        expect(h.controller.getSnapshot().round).toBeNull()
        expect(h.close).toHaveBeenCalledOnce()
    })
    it('falha de rede não concede pontos nem muda para treino local', async () => {
        const api: CardRoundApi = {
            start: vi.fn(() => Promise.reject(new Error('offline'))),
            observe: vi.fn(),
            cancel: vi.fn(),
        }
        const h = harness(api)
        await vi.waitFor(() =>
            expect(h.controller.getSnapshot().canStart).toBe(true),
        )
        await h.controller.start()
        expect(h.controller.getSnapshot().status).toBe('error')
        expect(h.controller.getSnapshot().round).toBeNull()
        h.controller.destroy()
    })
    it('fecha detector que falhou e pede recarga da câmera sem conceder pontos', async () => {
        const started = access()
        const api: CardRoundApi = {
            start: vi.fn(() => Promise.resolve(started)),
            observe: vi.fn(),
            cancel: vi.fn(() =>
                Promise.resolve({
                    ...started.round,
                    state: 'user_cancelled' as const,
                    score: 0,
                }),
            ),
        }
        const h = harness(api)
        await vi.waitFor(() =>
            expect(h.controller.getSnapshot().canStart).toBe(true),
        )
        h.tracker.detect.mockImplementation(() => {
            throw new Error('detector failed')
        })
        await h.controller.start()
        h.step()
        expect(h.controller.getSnapshot()).toMatchObject({
            status: 'error',
            failure: 'tracker',
            canStart: false,
            round: null,
        })
        expect(h.close).toHaveBeenCalledOnce()
        expect(api.observe).not.toHaveBeenCalled()
        h.controller.destroy()
    })
})
