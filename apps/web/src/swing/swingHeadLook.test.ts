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
    const drawNoop = () => undefined
    const context = new Proxy({}, { get: () => drawNoop, set: () => true })
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
    const overlay = document.createElement('canvas')
    vi.spyOn(overlay, 'getContext').mockReturnValue(null)
    const scene = document.createElement('canvas')
    const surfaces = {
        getVideo: () => video as HTMLVideoElement,
        getOverlay: () => overlay,
        getScene: () => scene,
        getEffects: () => ({ width: 800, height: 400, getContext: () => context }) as unknown as HTMLCanvasElement,
    }
    const controller = new SwingController({ guidedPreparation: false, ...env })
    const tick = (ms = 16, newCameraFrame = true) => {
        time += ms
        if (newCameraFrame) video.currentTime += 1
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
    return { controller, env, detectFace, faceTracker, tick, lastState, keys }
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
        // O desvio posicional decai e o giro contínuo para; a frente acumulada é preservada.
        settle(tick, 240)
        expect(controller.getSnapshot().faceVisible).toBe(false)
        expect(controller.getSnapshot().headTurn.turning).toBe(false)
        const stopped = lastState().yaw
        settle(tick, 120)
        expect(lastState().yaw).toBeCloseTo(stopped, 3)
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


it('o laço gráfico não calibra a cabeça repetindo uma única imagem', async () => {
    const { controller, detectFace, tick } = await playingWithFace()
    detectFace.mockReturnValue(face(0))
    tick()
    for (let i = 0; i < 20; i++) tick(16, false)
    expect(controller.getSnapshot().headDebug.calibrated).toBe(false)
    for (let i = 0; i < 20; i++) tick()
    expect(controller.getSnapshot().headDebug.calibrated).toBe(true)
})

it('inclinar para baixo após centralizar no neutro move o olhar para baixo', async () => {
    const { controller, detectFace, tick, lastState } = await playingWithFace()
    detectFace.mockReturnValue(face(0, 10))
    settle(tick, 20)
    controller.recenterHead()
    detectFace.mockReturnValue(face(0, -15))
    settle(tick, 120)
    expect(lastState().pitch).toBeLessThan(-0.05)
})

describe('sensibilidade do rosto configurável', () => {
    it('multiplica giro horizontal/vertical, mantendo padrão e sem recarregar detector', async () => {
        const h = await playingWithFace()
        h.detectFace.mockReturnValue(face(0))
        settle(h.tick, 30)
        expect(h.controller.getSnapshot().faceSensitivity).toBe(1)
        const loads = (h.env.createFaceTracker as ReturnType<typeof vi.fn>).mock.calls.length
        const initial = {yaw: h.lastState().yaw, pitch: h.lastState().pitch}
        h.detectFace.mockReturnValue(face(10, 10))
        settle(h.tick, 120)
        const normal = { yaw: h.lastState().yaw, pitch: h.lastState().pitch }
        h.controller.setFaceSensitivity(2)
        settle(h.tick, 120)
        expect(h.lastState().yaw).toBeCloseTo(initial.yaw + (normal.yaw - initial.yaw) * 2, 2)
        expect(h.lastState().pitch).toBeCloseTo(initial.pitch + (normal.pitch - initial.pitch) * 2, 2)
        h.controller.setFaceSensitivity(0.5)
        settle(h.tick, 120)
        expect(h.lastState().yaw).toBeCloseTo(initial.yaw + (normal.yaw - initial.yaw) * 0.5, 2)
        expect(h.lastState().pitch).toBeCloseTo(initial.pitch + (normal.pitch - initial.pitch) * 0.5, 2)
        expect((h.env.createFaceTracker as ReturnType<typeof vi.fn>).mock.calls.length).toBe(loads)
        h.controller.detach()
    })
    it('limita configuração e giro, ignora valores inválidos e preserva a opção na troca de modo e reinício', async () => {
        const h = await playingWithFace()
        h.controller.setFaceSensitivity(Infinity)
        expect(h.controller.getSnapshot().faceSensitivity).toBe(1)
        h.controller.setFaceSensitivity(99)
        expect(h.controller.getSnapshot().faceSensitivity).toBe(3)
        h.detectFace.mockReturnValue(face(0))
        settle(h.tick, 30)
        h.detectFace.mockReturnValue(face(70, 70))
        settle(h.tick, 45)
        expect(h.controller.getSnapshot().headTurn.turning).toBe(false)
        expect(Math.abs(h.lastState().yaw)).toBeLessThanOrEqual(70 * Math.PI / 180 + 0.001)
        expect(Math.abs(h.controller.getSnapshot().headDebug.pitchDeg)).toBeLessThanOrEqual(45)
        expect(Math.abs(h.lastState().pitch)).toBeLessThanOrEqual(55 * Math.PI / 180 + 0.001)
        h.controller.setFaceSensitivity(-4)
        expect(h.controller.getSnapshot().faceSensitivity).toBe(0.5)
        h.controller.setLookMode('auto')
        h.controller.setLookMode('face')
        await flush()
        expect(h.controller.getSnapshot().faceSensitivity).toBe(0.5)
        h.controller.restart()
        expect(h.controller.getSnapshot().faceSensitivity).toBe(0.5)
        h.controller.detach()
    })
    it('alterar o fator converge sem salto no primeiro quadro', async () => {
        const h = await playingWithFace()
        h.detectFace.mockReturnValue(face(0))
        settle(h.tick, 30)
        h.detectFace.mockReturnValue(face(15))
        settle(h.tick, 120)
        const before = h.lastState().yaw
        h.controller.setFaceSensitivity(3)
        h.tick()
        expect(Math.abs(h.lastState().yaw - before)).toBeLessThan(0.12)
        h.controller.detach()
    })
    it('rosto recuperado vira neutro pela integração do controlador', async () => {
        const h = await playingWithFace()
        h.detectFace.mockReturnValue(face(0))
        settle(h.tick, 30)
        h.detectFace.mockReturnValue(face(25))
        settle(h.tick, 60)
        h.detectFace.mockReturnValue(null)
        settle(h.tick, 20)
        h.detectFace.mockReturnValue(face(-20, 20))
        settle(h.tick, 120)
        expect(h.controller.getSnapshot().headDebug.yawDeg).toBe(0)
        expect(h.controller.getSnapshot().headDebug.pitchDeg).toBe(0)
        h.controller.detach()
    })
})

it.each([
    { name: 'parado', velocity: {x:0,y:0,z:0}, yaw: 0 },
    { name: 'em movimento', velocity: {x:10,y:0,z:0}, yaw: Math.PI / 2 },
])('Centralizar nivela a câmera inteira $name sem deslocar o personagem', async ({velocity, yaw}) => {
    const game = await playingWithFace()
    game.detectFace.mockReturnValue(face(0))
    settle(game.tick, 20)
    const state = game.lastState()
    state.yaw = 2.5
    state.pitch = 0.9
    state.velocity = velocity
    const position = {...state.position}
    game.controller.recenterHead()
    game.tick()
    expect(Math.abs(state.pitch - 0.9)).toBeLessThan(0.15)
    expect(Math.abs(state.yaw - 2.5)).toBeLessThan(0.35)
    settle(game.tick, 150)
    expect(state.pitch).toBeCloseTo(0, 3)
    expect(state.yaw).toBeCloseTo(yaw, 3)
    expect(state.position).toEqual(position)
    game.controller.detach()
})

it.each([-1, 1])('segurar a cabeça de lado por 1 s mantém giro no sentido %s', async (direction) => {
    const g = await playingWithFace()
    g.detectFace.mockReturnValue(face(0))
    settle(g.tick, 20)
    g.detectFace.mockReturnValue(face(direction * 25))
    settle(g.tick, 55)
    const beforeDwell = g.lastState().yaw
    settle(g.tick, 15)
    const afterDwell = g.lastState().yaw
    settle(g.tick, 60)
    expect(direction * (g.lastState().yaw - afterDwell)).toBeGreaterThan(0.4)
    expect(Math.abs(afterDwell - beforeDwell)).toBeLessThan(0.15)
    g.detectFace.mockReturnValue(face(0))
    settle(g.tick, 120)
    const stopped = g.lastState().yaw
    settle(g.tick, 120)
    expect(g.lastState().yaw).toBeCloseTo(stopped, 3)
    g.controller.detach()
})

it('interrompe giro por imagem congelada, teclado, centralização, modo e reinício', async () => {
    const g = await playingWithFace()
    g.detectFace.mockReturnValue(face(0)); settle(g.tick,20)
    g.detectFace.mockReturnValue(face(25)); settle(g.tick,150)
    expect(g.controller.getSnapshot().headTurn.turning).toBe(true)
    for(let i=0;i<30;i++) g.tick(16,false)
    expect(g.controller.getSnapshot().headTurn.turning).toBe(false)
    settle(g.tick,150)
    expect(g.controller.getSnapshot().headTurn.turning).toBe(true)
    g.keys.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft'}))
    settle(g.tick,10)
    expect(g.controller.getSnapshot().headTurn.intent).toBeNull()
    g.keys.dispatchEvent(new KeyboardEvent('keyup',{key:'ArrowLeft'}))
    settle(g.tick,150)
    g.controller.recenterHead(); settle(g.tick,10)
    expect(g.controller.getSnapshot().headTurn.intent).toBeNull()
    g.controller.restart(); settle(g.tick,30)
    expect(g.controller.getSnapshot().headTurn.intent).toBeNull()
    g.controller.setLookMode('auto'); await flush()
    expect(g.controller.getSnapshot().headTurn.turning).toBe(false)
    g.controller.detach()
})

it.each([-1, 1])('manter a intenção lateral acelera progressivamente o giro no sentido %s', async (direction) => {
    const g = await playingWithFace()
    g.detectFace.mockReturnValue(face(0)); settle(g.tick,20)
    g.detectFace.mockReturnValue(face(direction*25)); settle(g.tick,90)
    let before=g.lastState().yaw
    settle(g.tick,30)
    const base=direction*(g.lastState().yaw-before)
    expect(g.controller.getSnapshot().headTurn.speedMultiplier).toBe(1)
    settle(g.tick,135)
    before=g.lastState().yaw
    settle(g.tick,30)
    expect(direction*(g.lastState().yaw-before)).toBeGreaterThan(base*1.5)
    expect(g.controller.getSnapshot().headTurn.speedMultiplier).toBeGreaterThan(1.5)
    settle(g.tick,100)
    expect(g.controller.getSnapshot().headTurn.speedMultiplier).toBe(2)
    g.detectFace.mockReturnValue(face(0)); settle(g.tick,20)
    expect(g.controller.getSnapshot().headTurn.speedMultiplier).toBe(1)
    expect(g.controller.getSnapshot().headTurn.turning).toBe(false)
    g.controller.detach()
})
