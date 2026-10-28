import { describe, expect, it, vi } from 'vitest'

import { CLOSED_RATIO, OPEN_RATIO, pinchHand } from '../test-utils/fakeHand.js'
import { type HandTracker, type TrackedHand } from '../tracker/handTracker.js'
import { MarblesController, modeFromSearch } from './marblesController.js'

/** Relógio, quadros de vídeo e detector controlados pelo teste. */
function harness(
    options: { createTracker?: () => Promise<HandTracker>; videoFrameCallback?: boolean } = {},
) {
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

    // Com `videoFrameCallback`, o vídeo avisa cada quadro novo da câmera, como o Chrome faz.
    let cameraFrame: (() => void) | null = null
    const cancelVideoFrameCallback = vi.fn(() => {
        cameraFrame = null
    })
    if (options.videoFrameCallback) {
        Object.assign(video, {
            requestVideoFrameCallback: (callback: (now: number, metadata: object) => void) => {
                cameraFrame = () => callback(0, {})
                return 7
            },
            cancelVideoFrameCallback,
        })
    }

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
        cancelVideoFrameCallback,
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
        /** Um passo do laço de exibição; `currentTime` sempre avança (fluxo ao vivo), mas a câmera só entrega quadro novo se pedido. */
        runLive(hand: TrackedHand | null, newCameraFrame: boolean, stepMs = 16) {
            next = hand
            nowMs += stepMs
            media.currentTime += stepMs / 1000
            if (newCameraFrame) {
                const deliver = cameraFrame
                cameraFrame = null
                deliver?.()
            }
            const callback = queued
            queued = null
            callback?.()
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

    it('publica a posição da mão no campo a cada quadro, aberta ou fechada', async () => {
        const h = harness()
        await h.ready()
        expect(h.controller.getSnapshot().hand).toBeNull()
        h.run(open(300, 200))
        const openHand = h.controller.getSnapshot().hand
        expect(openHand?.closed).toBe(false)
        expect(openHand?.point.x).toBeCloseTo(300, 3)
        expect(openHand?.point.y).toBeCloseTo(200, 3)
        h.run(closed(420, 260))
        const closedHand = h.controller.getSnapshot().hand
        expect(closedHand?.closed).toBe(true)
        expect(closedHand?.point.x).toBeCloseTo(420, 3)
        h.run(null)
        expect(h.controller.getSnapshot().hand).toBeNull()
    })

    it('pinça aberta, fechada em qualquer ponto e arrastada leva a aiming com a previsão', async () => {
        const h = harness()
        await h.ready()
        h.run(open(100, 300))
        h.run(closed(150, 300))
        h.run(closed(50, 300))
        const { round } = h.controller.getSnapshot()
        expect(round.state).toBe('aiming')
        // Arrasto de 100 unidades na escala padrão de 1,5: pinça virtual 150 à esquerda da bolinha.
        expect(round.aim?.pinch.x).toBeCloseTo(0, 3)
        expect(round.aim?.shot?.velocity.x).toBeCloseTo(750, 2)
    })

    it('a pinça pode fechar longe da bolinha e a mira ainda funciona (qualquer mão, qualquer lado)', async () => {
        const h = harness()
        await h.ready()
        h.run(open(650, 450))
        h.run(closed(650, 450))
        h.run(closed(550, 450))
        const { round } = h.controller.getSnapshot()
        expect(round.state).toBe('aiming')
        expect(round.aim?.shot?.velocity.x).toBeCloseTo(750, 2)
        expect(round.aim?.shot?.velocity.y).toBeCloseTo(0, 2)
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

describe('modeFromSearch', () => {
    it('?mode=estalo escolhe o modo estalo; qualquer outro valor mantém a pinça', () => {
        expect(modeFromSearch('?mode=estalo')).toBe('flick')
        expect(modeFromSearch('?mode=ESTALO')).toBe('flick')
        expect(modeFromSearch('')).toBe('pinch')
        expect(modeFromSearch('?mode=pinca')).toBe('pinch')
        expect(modeFromSearch('?mode=outro')).toBe('pinch')
        expect(modeFromSearch('?delegate=cpu')).toBe('pinch')
    })
})

describe('MarblesController: modo estalo (alpha)', () => {
    /** Intervalo entre quadros novos de uma webcam de cerca de 15 quadros/s. */
    const STEP = 67
    const tucked = (ratio = 0.8) => pinchHand({ ratio, x: 300, y: 300 })

    /** Polegar preso contra o indicador por alguns quadros, com a mão apontando para cima. */
    function arm(h: ReturnType<typeof harness>) {
        h.run(tucked(), 3, STEP)
    }

    it('começa no modo pinça e setMode muda o modo no snapshot', async () => {
        const h = harness()
        await h.ready()
        expect(h.controller.getSnapshot().mode).toBe('pinch')
        h.controller.setMode('flick')
        expect(h.controller.getSnapshot().mode).toBe('flick')
    })

    it('com o polegar preso a mão arma e publica a direção da mão (apontando para cima, o tiro sobe)', async () => {
        const h = harness()
        await h.ready()
        h.controller.setMode('flick')
        arm(h)
        const { round, debug } = h.controller.getSnapshot()
        expect(round.state).toBe('aiming')
        expect(round.flick?.direction.y).toBeCloseTo(-1, 6)
        expect(debug.flick.armed).toBe(true)
    })

    it('esticar o polegar e mantê-lo esticado dispara; a velocidade e o resultado aparecem na depuração', async () => {
        const h = harness()
        await h.ready()
        h.controller.setMode('flick')
        arm(h)
        h.run(tucked(1.5), 3, STEP)
        const { round, debug } = h.controller.getSnapshot()
        expect(round.state).toBe('rolling')
        expect(round.shots).toBe(1)
        expect(debug.flick.lastResult).toBe('disparado')
        const speed = (1.5 - 0.8) / (STEP / 1000)
        expect(debug.flick.lastOpenSpeed).toBeCloseTo(speed, 1)
        // Força na escala logarítmica de 3 a 20 razão/s.
        expect(debug.flick.lastPower).toBeCloseTo(Math.log(speed / 3) / Math.log(20 / 3), 3)
        expect(debug.flick.armed).toBe(false)
        h.run(null, 4, STEP)
        expect(h.controller.getSnapshot().round.shooter.y).toBeLessThan(300)
    })

    it('uma oscilação que sobe e volta no quadro seguinte não dispara e registra "não sustentado"', async () => {
        const h = harness()
        await h.ready()
        h.controller.setMode('flick')
        arm(h)
        h.run(tucked(1.5), 1, STEP)
        h.run(tucked(0.8), 1, STEP)
        const { round, debug } = h.controller.getSnapshot()
        expect(round.shots).toBe(0)
        expect(round.state).toBe('ready')
        expect(debug.flick.lastResult).toBe('não sustentado')
        expect(debug.flick.lastPower).toBeNull()
    })

    it('uma subida pequena (a razão só derivou até o limite) registra "fraco demais"', async () => {
        const h = harness()
        await h.ready()
        h.controller.setMode('flick')
        h.run(tucked(1.0), 3, STEP)
        h.run(tucked(1.25), 1, STEP)
        const { round, debug } = h.controller.getSnapshot()
        expect(round.shots).toBe(0)
        expect(round.state).toBe('ready')
        expect(debug.flick.lastResult).toBe('fraco demais')
    })

    it('estalos de velocidades diferentes dão forças diferentes na depuração', async () => {
        const h = harness()
        await h.ready()
        h.controller.setMode('flick')
        arm(h)
        h.run(tucked(1.8), 3, STEP)
        const strong = h.controller.getSnapshot().debug.flick.lastPower
        h.controller.newRound()
        arm(h)
        // Subida em dois passos: o pico fica abaixo do salto de um quadro só.
        h.run(tucked(1.3), 1, STEP)
        h.run(tucked(1.5), 2, STEP)
        const weaker = h.controller.getSnapshot().debug.flick.lastPower
        expect(strong).not.toBeNull()
        expect(weaker).not.toBeNull()
        expect(weaker ?? 0).toBeLessThan(strong ?? 0)
    })

    it('palma aberta durante a confirmação é a mão se abrindo: não dispara e registra "mão aberta"', async () => {
        const h = harness()
        await h.ready()
        h.controller.setMode('flick')
        arm(h)
        const palm = { ...tucked(1.5), gesture: { name: 'Open_Palm', score: 0.9 } }
        h.run(palm, 3, STEP)
        const { round, debug } = h.controller.getSnapshot()
        expect(round.shots).toBe(0)
        expect(debug.flick.lastResult).toBe('mão aberta')
        expect(debug.flick.lastPower).toBeNull()
    })

    it('a depuração mostra o gesto reconhecido e a etapa do estalo', async () => {
        const h = harness()
        await h.ready()
        h.controller.setMode('flick')
        expect(h.controller.getSnapshot().debug.flick.gesture).toBeNull()
        expect(h.controller.getSnapshot().debug.flick.phase).toBe('idle')
        h.run({ ...tucked(), gesture: { name: 'Closed_Fist', score: 0.8 } }, 3, STEP)
        let flick = h.controller.getSnapshot().debug.flick
        expect(flick.gesture).toEqual({ name: 'Closed_Fist', score: 0.8 })
        expect(flick.phase).toBe('armed')
        h.run(tucked(1.5), 1, STEP)
        flick = h.controller.getSnapshot().debug.flick
        expect(flick.phase).toBe('pending')
        expect(flick.gesture).toBeNull()
    })

    it('trocar de modo reinicia a rodada e zera o armado', async () => {
        const h = harness()
        await h.ready()
        h.controller.setMode('flick')
        arm(h)
        h.run(tucked(1.5), 3, STEP)
        expect(h.controller.getSnapshot().round.shots).toBe(1)
        h.controller.setMode('pinch')
        const { round, debug } = h.controller.getSnapshot()
        expect(round.shots).toBe(0)
        expect(round.state).toBe('ready')
        expect(debug.flick.armed).toBe(false)
        expect(debug.flick.lastResult).toBeNull()
    })

    it('no modo pinça a pinça comum arma o elástico e o estalo não existe', async () => {
        const h = harness()
        await h.ready()
        h.run(open(300, 300), 2, STEP)
        h.run(closed(300, 300), 3, STEP)
        expect(h.controller.getSnapshot().round.flick).toBeNull()
        expect(h.controller.getSnapshot().round.aim).not.toBeNull()
    })
})

describe('MarblesController: quadros novos da câmera', () => {
    it('sem requestVideoFrameCallback, recua para currentTime e não reprocessa o quadro repetido', async () => {
        const h = harness()
        await h.ready()
        h.run(open(300, 300), 2)
        const processed = h.detect.mock.calls.length
        h.runWithoutNewFrame()
        h.runWithoutNewFrame()
        expect(h.detect.mock.calls.length).toBe(processed)
        h.run(open(300, 300))
        expect(h.detect.mock.calls.length).toBe(processed + 1)
    })

    it('com requestVideoFrameCallback, só processa quando a câmera entregou um quadro, mesmo com currentTime avançando', async () => {
        const h = harness({ videoFrameCallback: true })
        await h.ready()
        h.runLive(open(300, 300), false)
        h.runLive(open(300, 300), false)
        h.runLive(open(300, 300), false)
        expect(h.detect).not.toHaveBeenCalled()
        h.runLive(open(300, 300), true)
        expect(h.detect).toHaveBeenCalledTimes(1)
        h.runLive(open(300, 300), false)
        expect(h.detect).toHaveBeenCalledTimes(1)
        h.runLive(open(300, 300), true)
        expect(h.detect).toHaveBeenCalledTimes(2)
    })

    it('a taxa da câmera é nula até fechar a primeira janela de 1 s', async () => {
        const h = harness()
        await h.ready()
        h.run(open(300, 300), 5)
        expect(h.controller.getSnapshot().debug.cameraFps).toBeNull()
    })

    it('sem requestVideoFrameCallback, conta os quadros novos por segundo', async () => {
        const h = harness()
        await h.ready()
        h.run(open(300, 300), 40, 33)
        const fps = h.controller.getSnapshot().debug.cameraFps
        expect(fps).not.toBeNull()
        expect(fps).toBeGreaterThan(29)
        expect(fps).toBeLessThan(31.5)
    })

    it('com requestVideoFrameCallback, a taxa é a da câmera e não a do laço de exibição', async () => {
        const h = harness({ videoFrameCallback: true })
        await h.ready()
        // Laço a cada 16 ms; a câmera entrega um quadro a cada 3 passos (48 ms, cerca de 20,8 por segundo).
        for (let i = 0; i < 90; i++) h.runLive(open(300, 300), i % 3 === 0)
        const fps = h.controller.getSnapshot().debug.cameraFps
        expect(fps).not.toBeNull()
        expect(fps).toBeGreaterThan(20)
        expect(fps).toBeLessThan(22)
        const { frames } = h.controller.getSnapshot().debug
        expect(frames).toBe(30)
    })

    it('desligar a câmera cancela a espera pelo quadro da câmera', async () => {
        const h = harness({ videoFrameCallback: true })
        await h.ready()
        h.controller.setCamera(false, false)
        expect(h.cancelVideoFrameCallback).toHaveBeenCalled()
    })
})
