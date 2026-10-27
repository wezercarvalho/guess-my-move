import { describe, expect, it, vi } from 'vitest'

import { CLOSED_RATIO, OPEN_RATIO, pinchHand } from '../test-utils/fakeHand.js'
import { type HandTracker, type TrackedHand } from '../tracker/handTracker.js'
import { MarblesController } from './marblesController.js'

/** Relógio, quadros de vídeo e detector controlados pelo teste. */
function harness(options: { createTracker?: () => Promise<HandTracker> } = {}) {
    let nowMs = 1000
    let queued: (() => void) | null = null
    const media = { currentTime: 0 }
    let next: TrackedHand | null = null

    const video = {
        readyState: 4,
        videoWidth: 640,
        videoHeight: 480,
        clientWidth: 640,
        clientHeight: 480,
        get currentTime() {
            return media.currentTime
        },
    } as unknown as HTMLVideoElement

    const detect = vi.fn((): TrackedHand | null => next)
    const close = vi.fn()
    const tracker: HandTracker = { delegate: 'GPU', detect, close }
    const createTracker = options.createTracker ?? vi.fn(() => Promise.resolve(tracker))
    const cancelFrame = vi.fn(() => {
        queued = null
    })

    const controller = new MarblesController({
        createTracker,
        now: () => nowMs,
        requestFrame: (callback) => {
            queued = callback
            return 1
        },
        cancelFrame,
    })
    controller.attach({ getVideo: () => video, getOverlay: () => null })

    return {
        controller,
        detect,
        close,
        cancelFrame,
        createTracker,
        /** Liga a câmera e espera o detector ficar pronto. */
        async ready() {
            controller.setCamera(true, false)
            await vi.waitFor(() => {
                expect(controller.getSnapshot().trackerStatus).toBe('ready')
            })
        },
        /** Um quadro de vídeo novo por passo, com a mão dada (ou nenhuma). */
        run(hand: TrackedHand | null, count = 1, stepMs = 33) {
            for (let i = 0; i < count; i++) {
                next = hand
                nowMs += stepMs
                media.currentTime += stepMs / 1000
                const callback = queued
                queued = null
                callback?.()
            }
        },
        /** Passa o relógio sem quadro novo de vídeo. */
        runWithoutNewFrame(stepMs = 33) {
            nowMs += stepMs
            const callback = queued
            queued = null
            callback?.()
        },
        hasQueuedFrame: () => queued !== null,
    }
}

const open = (x: number, y: number) => pinchHand({ ratio: OPEN_RATIO, x, y })
const closed = (x: number, y: number) => pinchHand({ ratio: CLOSED_RATIO, x, y })

/** Pinça aberta, fecha na bolinha, arrasta até (20, 300) e abre: o tiro direto no alvo. */
function shootAtTarget(h: ReturnType<typeof harness>) {
    h.run(open(100, 300))
    h.run(closed(150, 300))
    h.run(closed(20, 300), 2)
    h.run(open(20, 300))
}

describe('MarblesController: câmera e detector', () => {
    it('começa ocioso e fica pronto quando a câmera e o detector estão prontos', async () => {
        const h = harness()
        expect(h.controller.getSnapshot().round.state).toBe('idle')
        expect(h.controller.getSnapshot().trackerStatus).toBe('idle')
        await h.ready()
        const snap = h.controller.getSnapshot()
        expect(snap.round.state).toBe('ready')
        expect(snap.debug.delegate).toBe('GPU')
    })

    it('câmera negada leva a camera_denied sem carregar o detector', () => {
        const h = harness()
        h.controller.setCamera(false, true)
        expect(h.controller.getSnapshot().round.state).toBe('camera_denied')
        expect(h.createTracker).not.toHaveBeenCalled()
    })

    it('falha ao criar o detector leva a tracker_error com o motivo', async () => {
        const h = harness({ createTracker: () => Promise.reject(new Error('modelo ausente')) })
        h.controller.setCamera(true, false)
        await vi.waitFor(() => {
            expect(h.controller.getSnapshot().round.state).toBe('tracker_error')
        })
        expect(h.controller.getSnapshot().round.failureReason).toBe('modelo ausente')
        expect(h.controller.getSnapshot().trackerStatus).toBe('error')
    })

    it('desligar a câmera volta ao estado ocioso e para o laço', async () => {
        const h = harness()
        await h.ready()
        h.controller.setCamera(false, false)
        expect(h.controller.getSnapshot().round.state).toBe('idle')
        expect(h.cancelFrame).toHaveBeenCalled()
    })

    it('detach encerra o laço e fecha o detector', async () => {
        const h = harness()
        await h.ready()
        h.controller.detach()
        expect(h.close).toHaveBeenCalledTimes(1)
        expect(h.hasQueuedFrame()).toBe(false)
        expect(h.controller.getSnapshot().trackerStatus).toBe('idle')
    })

    it('erro do detector durante o jogo leva a tracker_error', async () => {
        const h = harness()
        await h.ready()
        h.detect.mockImplementationOnce(() => {
            throw new Error('falha de inferência')
        })
        h.run(open(100, 300))
        expect(h.controller.getSnapshot().round.state).toBe('tracker_error')
        expect(h.controller.getSnapshot().round.failureReason).toBe('falha de inferência')
    })
})

describe('MarblesController: laço por quadro', () => {
    it('só chama o detector quando há quadro novo de vídeo', async () => {
        const h = harness()
        await h.ready()
        h.run(open(100, 300), 3)
        expect(h.detect).toHaveBeenCalledTimes(3)
        h.runWithoutNewFrame()
        h.runWithoutNewFrame()
        expect(h.detect).toHaveBeenCalledTimes(3)
    })

    it('conta quadros, latência e a leitura da pinça no painel de depuração', async () => {
        const h = harness()
        await h.ready()
        h.run(closed(400, 100), 2, 120)
        const debug = h.controller.getSnapshot().debug
        expect(debug.frames).toBe(2)
        expect(debug.handVisible).toBe(true)
        expect(debug.pinchClosed).toBe(true)
        expect(debug.ratio).toBeCloseTo(CLOSED_RATIO, 6)
        expect(debug.medianMs).not.toBeNull()
        h.run(null, 1, 120)
        expect(h.controller.getSnapshot().debug.handVisible).toBe(false)
        expect(h.controller.getSnapshot().debug.pinchClosed).toBe(false)
    })

    it('pinça aberta, fechada perto da bolinha e arrastada leva a aiming com a previsão', async () => {
        const h = harness()
        await h.ready()
        h.run(open(100, 300))
        h.run(closed(150, 300))
        h.run(closed(50, 300))
        const { round } = h.controller.getSnapshot()
        expect(round.state).toBe('aiming')
        expect(round.aim?.pinch.x).toBeCloseTo(50, 3)
        expect(round.aim?.shot?.velocity.x).toBeCloseTo(500, 2)
    })

    it('soltar a pinça dispara e a bolinha rola até acertar o alvo', async () => {
        const h = harness()
        await h.ready()
        shootAtTarget(h)
        expect(h.controller.getSnapshot().round.state).toBe('rolling')
        expect(h.controller.getSnapshot().round.shots).toBe(1)
        h.run(null, 120, 16)
        const { round } = h.controller.getSnapshot()
        expect(round.state).toBe('hit')
        expect(round.hitShots).toBe(1)
    })

    it('newRound zera a rodada depois do acerto', async () => {
        const h = harness()
        await h.ready()
        shootAtTarget(h)
        h.run(null, 120, 16)
        h.controller.newRound()
        const { round } = h.controller.getSnapshot()
        expect(round.state).toBe('ready')
        expect(round.shots).toBe(0)
        expect(round.hitShots).toBeNull()
    })

    it('newRound depois de tracker_error recarrega o detector', async () => {
        const create = vi
            .fn<() => Promise<HandTracker>>()
            .mockRejectedValueOnce(new Error('falhou'))
        const h = harness({ createTracker: create })
        h.controller.setCamera(true, false)
        await vi.waitFor(() => {
            expect(h.controller.getSnapshot().round.state).toBe('tracker_error')
        })
        const tracker: HandTracker = { delegate: 'CPU', detect: vi.fn(() => null), close: vi.fn() }
        create.mockResolvedValueOnce(tracker)
        h.controller.newRound()
        await vi.waitFor(() => {
            expect(h.controller.getSnapshot().round.state).toBe('ready')
        })
        expect(h.controller.getSnapshot().debug.delegate).toBe('CPU')
    })
})
