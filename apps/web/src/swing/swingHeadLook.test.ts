import { type City, type FaceReading, type SwingState } from '@guess-my-move/swing'
import { describe, expect, it, vi } from 'vitest'

import { type FaceTracker } from '../tracker/faceTracker.js'
import { type HandTracker, type TrackedHand } from '../tracker/handTracker.js'
import { type SwingRenderer } from './cityRenderer.js'
import { SwingController, type SwingEnv } from './swingController.js'

const city: City = {
    version: 1,
    name: 'teste',
    attribution: 'Dados do mapa de teste',
    bounds: { minX: -300, maxX: 300, minZ: -300, maxZ: 300 },
    buildings: [],
    roads: [],
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

/**
 * Leitura de rosto simulada virado `yaw`/`pitch` graus; a câmera (espelhada) dá yaw positivo
 * ao virar para a direita. Inclui um ponto de rosto para o desenho.
 */
const face = (yaw: number, pitch = 0): FaceReading => ({
    orientation: { yaw: (yaw * Math.PI) / 180, pitch: (pitch * Math.PI) / 180 },
    landmarks: [{ x: 0.5, y: 0.5 }],
})

async function playingWithFace() {
    let time = 0
    let pending: (() => void) | null = null
    const renderer = {
        resize: vi.fn(),
        render: vi.fn(),
        dispose: vi.fn(),
        project: vi.fn(() => ({ x: 0.5, y: 0.3, behind: false })),
    }
    const context = new Proxy({}, { get: () => vi.fn(), set: () => true })
    const keys = new EventTarget()
    const handTracker = {
        delegate: 'CPU' as const,
        detect: vi.fn<HandTracker['detect']>(() => null),
        detectAll: vi.fn<NonNullable<HandTracker['detectAll']>>(() => [] as TrackedHand[]),
        close: vi.fn(),
    }
    const detectFace = vi.fn<FaceTracker['detect']>(() => null)
    const faceTracker: FaceTracker = { delegate: 'CPU', detect: detectFace, close: vi.fn() }
    const env: SwingEnv = {
        createTracker: vi.fn(() => Promise.resolve(handTracker)),
        createFaceTracker: vi.fn(() => Promise.resolve(faceTracker)),
        loadCity: vi.fn(() => Promise.resolve(city)),
        createRenderer: vi.fn(() => renderer as SwingRenderer),
        requestFrame: (callback) => {
            pending = callback
            return 1
        },
        cancelFrame: vi.fn(() => {
            pending = null
        }),
        now: () => time,
        keys,
    }
    const video = { readyState: 4, videoWidth: 640, videoHeight: 480, currentTime: 0 }
    const surfaces = {
        getVideo: () => video as HTMLVideoElement,
        getOverlay: () => document.createElement('canvas'),
        getScene: () => document.createElement('canvas'),
        getEffects: () => ({ width: 800, height: 400, getContext: () => context }) as unknown as HTMLCanvasElement,
    }
    const controller = new SwingController(env)
    const tick = (ms = 16) => {
        time += ms
        video.currentTime += 1
        const callback = pending
        pending = null
        callback?.()
    }
    const lastState = (): SwingState => {
        const call = renderer.render.mock.calls.at(-1) as [SwingState] | undefined
        if (!call) throw new Error('nenhum quadro desenhado')
        return call[0]
    }
    controller.attach(surfaces)
    await flush()
    controller.setCamera(true)
    await flush()
    return { controller, env, detectFace, faceTracker, tick, lastState }
}

/** Dá quadros para a calibração automática e a suavização estabilizarem. */
function settle(tick: (ms?: number) => void, steps = 60) {
    for (let i = 0; i < steps; i++) tick()
}

describe('SwingController com o rastreador de rosto', () => {
    it('carrega o detector de rosto quando a câmera liga', async () => {
        const { controller } = await playingWithFace()
        expect(controller.getSnapshot().faceTrackerStatus).toBe('ready')
    })

    it('virar a cabeça para a direita gira a câmera para a direita (olhar cresce)', async () => {
        const { detectFace, tick, lastState } = await playingWithFace()
        // Calibra no neutro.
        detectFace.mockReturnValue(face(0))
        settle(tick, 20)
        const before = lastState().yaw
        detectFace.mockReturnValue(face(25))
        settle(tick, 120)
        expect(lastState().yaw).toBeGreaterThan(before + 0.05)
    })

    it('virar a cabeça para a esquerda gira a câmera para a esquerda', async () => {
        const { detectFace, tick, lastState } = await playingWithFace()
        detectFace.mockReturnValue(face(0))
        settle(tick, 20)
        const before = lastState().yaw
        detectFace.mockReturnValue(face(-25))
        settle(tick, 120)
        expect(lastState().yaw).toBeLessThan(before - 0.05)
    })

    it('inclinar a cabeça para cima e para baixo inclina a câmera', async () => {
        const { detectFace, tick, lastState } = await playingWithFace()
        detectFace.mockReturnValue(face(0, 0))
        settle(tick, 20)
        detectFace.mockReturnValue(face(0, 25))
        settle(tick, 120)
        expect(lastState().pitch).toBeGreaterThan(0.05)
    })

    it('parado no neutro, a câmera não gira sozinha pelo rosto', async () => {
        const { detectFace, tick, lastState } = await playingWithFace()
        detectFace.mockReturnValue(face(0))
        settle(tick, 30)
        const settled = lastState().yaw
        settle(tick, 120)
        expect(Math.abs(lastState().yaw - settled)).toBeLessThan(0.02)
    })

    it('sem rosto, a câmera volta ao acompanhamento automático sem salto', async () => {
        const { controller, detectFace, tick, lastState } = await playingWithFace()
        detectFace.mockReturnValue(face(0))
        settle(tick, 20)
        detectFace.mockReturnValue(face(25))
        settle(tick, 120)
        const turned = lastState().yaw
        // Rosto some: o PRIMEIRO quadro sem rosto não dá salto — o desvio decai suave (bem
        // menos que voltar tudo de uma vez a zero), no mesmo ritmo com que a câmera já se movia.
        detectFace.mockReturnValue(null)
        tick()
        expect(Math.abs(lastState().yaw - turned)).toBeLessThan(Math.abs(turned) * 0.5)
        // Depois de vários quadros, o desvio da cabeça volta a perto de zero (sem rosto) e o
        // snapshot (publicado no intervalo) marca o rosto ausente.
        settle(tick, 120)
        expect(controller.getSnapshot().faceVisible).toBe(false)
        expect(Math.abs(controller.getSnapshot().headDebug.yawDeg)).toBeLessThan(5)
    })

    it('expõe a leitura da cabeça para a depuração', async () => {
        const { controller, detectFace, tick } = await playingWithFace()
        detectFace.mockReturnValue(face(0))
        settle(tick, 20)
        const debug = controller.getSnapshot().headDebug
        expect(debug.faceVisible).toBe(true)
        expect(debug.calibrated).toBe(true)
        detectFace.mockReturnValue(null)
        settle(tick, 10)
        expect(controller.getSnapshot().headDebug.faceVisible).toBe(false)
    })

    it('centralizar recalibra o neutro na pose atual da cabeça', async () => {
        const { controller, detectFace, tick } = await playingWithFace()
        detectFace.mockReturnValue(face(0))
        settle(tick, 20)
        detectFace.mockReturnValue(face(25))
        settle(tick, 60)
        expect(Math.abs(controller.getSnapshot().headDebug.yawDeg)).toBeGreaterThan(5)
        // Centralizar trata os 25° atuais como o novo zero: o desvio volta a perto de zero.
        controller.recenterHead()
        settle(tick, 120)
        expect(controller.getSnapshot().headDebug.calibrated).toBe(true)
        expect(Math.abs(controller.getSnapshot().headDebug.yawDeg)).toBeLessThan(5)
    })

    it('expõe o estado do detector de rosto no snapshot', async () => {
        const { controller } = await playingWithFace()
        expect(controller.getSnapshot().faceTrackerStatus).toBe('ready')
        expect(controller.getSnapshot().faceTrackerFailure).toBeNull()
    })
})

describe('SwingController — direção do olhar (Automática vs Rosto)', () => {
    it('começa no modo Rosto e carrega o detector de rosto', async () => {
        const { controller } = await playingWithFace()
        expect(controller.getSnapshot().lookMode).toBe('face')
        expect(controller.getSnapshot().faceTrackerStatus).toBe('ready')
    })

    it('no modo Automática o detector de rosto fica desligado e não recarrega', async () => {
        const { controller, env } = await playingWithFace()
        const createFace = env.createFaceTracker as ReturnType<typeof vi.fn>
        const callsWhileFace = createFace.mock.calls.length
        controller.setLookMode('auto')
        await flush()
        expect(controller.getSnapshot().lookMode).toBe('auto')
        expect(controller.getSnapshot().faceTrackerStatus).toBe('idle')
        // Em Automática, novos ciclos de sync não recarregam o detector.
        controller.setCamera(false)
        controller.setCamera(true)
        await flush()
        expect(controller.getSnapshot().faceTrackerStatus).toBe('idle')
        expect(createFace.mock.calls.length).toBe(callsWhileFace)
    })

    it('trocar para Automática durante o jogo libera o detector sem vazar', async () => {
        const { controller, faceTracker, detectFace, tick } = await playingWithFace()
        detectFace.mockReturnValue(face(0))
        settle(tick, 20)
        expect(controller.getSnapshot().faceTrackerStatus).toBe('ready')
        controller.setLookMode('auto')
        await flush()
        expect((faceTracker.close as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0)
        expect(controller.getSnapshot().faceTrackerStatus).toBe('idle')
        expect(controller.getSnapshot().faceVisible).toBe(false)
    })

    it('ao voltar para Automática, o desvio da cabeça é descartado sem salto', async () => {
        const { controller, detectFace, tick, lastState } = await playingWithFace()
        detectFace.mockReturnValue(face(0))
        settle(tick, 20)
        detectFace.mockReturnValue(face(25))
        settle(tick, 120)
        const turned = lastState().yaw
        controller.setLookMode('auto')
        // O primeiro quadro em Automática não dá salto na câmera (sem somar/subtrair de uma vez).
        tick()
        expect(Math.abs(lastState().yaw - turned)).toBeLessThan(0.05)
    })

    it('voltar para Rosto recarrega o detector', async () => {
        const { controller, env } = await playingWithFace()
        controller.setLookMode('auto')
        await flush()
        controller.setLookMode('face')
        await flush()
        expect(controller.getSnapshot().faceTrackerStatus).toBe('ready')
        expect((env.createFaceTracker as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(2)
    })

    it('expõe o modo ativo no snapshot de depuração', async () => {
        const { controller } = await playingWithFace()
        expect(controller.getSnapshot().lookMode).toBe('face')
        controller.setLookMode('auto')
        await flush()
        expect(controller.getSnapshot().lookMode).toBe('auto')
    })
})
