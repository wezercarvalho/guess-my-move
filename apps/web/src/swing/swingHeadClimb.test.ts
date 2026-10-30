import { type City, type FaceReading, type SwingState } from '@guess-my-move/swing'
import { describe, expect, it, vi } from 'vitest'

import { type FaceTracker } from '../tracker/faceTracker.js'
import { type HandTracker, type TrackedHand } from '../tracker/handTracker.js'
import { type SwingRenderer } from './cityRenderer.js'
import { SwingController, type SwingEnv } from './swingController.js'

/** Prédio-paredão logo à frente do ponto de partida (olhando para -Z), alto o bastante para escalar. */
const city: City = {
    version: 1,
    name: 'teste',
    attribution: 'Dados do mapa de teste',
    bounds: { minX: -400, maxX: 400, minZ: -400, maxZ: 400 },
    buildings: [{ height: 400, ring: [-200, -140, 200, -140, 200, -60, -200, -60] }],
    roads: [],
}

/** Palma aberta com a geometria completa (dedos esticados), no x pedido. */
const palm = (x = 0.8): TrackedHand => {
    const points = Array.from({ length: 21 }, () => ({ x, y: 0.8 }))
    const finger = (first: number, fx: number) => {
        points[first] = { x: fx, y: 0.6 }
        points[first + 1] = { x: fx, y: 0.53 }
        points[first + 2] = { x: fx, y: 0.47 }
        points[first + 3] = { x: fx, y: 0.4 }
    }
    finger(5, x - 0.06)
    finger(9, x)
    finger(13, x + 0.06)
    finger(17, x + 0.12)
    points[4] = { x: x - 0.24, y: 0.6 }
    return { landmarks: points }
}

/** Rosto simulado virado `yaw`/`pitch` graus (yaw > 0: para a direita do jogador; pitch > 0: para cima). */
const face = (yaw: number, pitch = 0): FaceReading => ({
    orientation: { yaw: (yaw * Math.PI) / 180, pitch: (pitch * Math.PI) / 180 },
    landmarks: [{ x: 0.5, y: 0.5 }],
})

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

async function playing() {
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
    const detectAll = vi.fn<NonNullable<HandTracker['detectAll']>>(() => [])
    const handTracker = {
        delegate: 'CPU' as const,
        detect: vi.fn<HandTracker['detect']>(() => null),
        detectAll,
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
    const press = (key: string) => keys.dispatchEvent(new KeyboardEvent('keydown', { key }))
    const release = (key: string) => keys.dispatchEvent(new KeyboardEvent('keyup', { key }))
    const lastState = (): SwingState => {
        const call = renderer.render.mock.calls.at(-1) as [SwingState] | undefined
        if (!call) throw new Error('nenhum quadro desenhado')
        return call[0]
    }
    controller.attach(surfaces)
    await flush()
    controller.setCamera(true)
    await flush()
    return { controller, detectAll, detectFace, tick, press, release, lastState }
}

type Playing = Awaited<ReturnType<typeof playing>>

/** Lança a teia, puxa e bate na fachada; com a palma aberta, agarra. Calibra o rosto no neutro. */
function gripWall({ controller, detectAll, detectFace, tick, press, release, lastState }: Playing) {
    detectFace.mockReturnValue(face(0, 0))
    tick()
    press(' ')
    press('c')
    let touched = false
    for (let i = 0; i < 6000 && !touched; i++) {
        tick()
        touched = lastState().touchingWall
        if (!touched && !controller.getSnapshot().hud.webAttached) press(' ')
    }
    if (!touched) throw new Error('não encostou na parede')
    // Ainda prensado na fachada: a palma aberta agarra; só então solta as teclas.
    detectAll.mockReturnValue([palm()])
    for (let i = 0; i < 4; i++) tick()
    release(' ')
    release('c')
    for (let i = 0; i < 30; i++) tick()
    if (!controller.getSnapshot().hud.gripped) throw new Error('não agarrou')
}

const run = (tick: (ms?: number) => void, ms: number) => {
    for (let elapsed = 0; elapsed < ms; elapsed += 16) tick()
}

describe('SwingController — escalar olhando (modo Rosto)', () => {
    it('olhar para cima agarrado: só começa a subir depois de ~2 s', async () => {
        const game = await playing()
        gripWall(game)
        const y0 = game.lastState().position.y
        game.detectFace.mockReturnValue(face(0, 25))
        run(game.tick, 1200)
        expect(Math.abs(game.lastState().position.y - y0)).toBeLessThan(0.5)
        expect(game.controller.getSnapshot().headClimb.intent).toBe('up')
        expect(game.controller.getSnapshot().headClimb.climbing).toBe(false)
        run(game.tick, 2200)
        expect(game.controller.getSnapshot().headClimb.climbing).toBe(true)
        expect(game.lastState().position.y).toBeGreaterThan(y0 + 2)
    })

    it('olhar para baixo agarrado, por ~2 s, desce', async () => {
        const game = await playing()
        gripWall(game)
        const y0 = game.lastState().position.y
        game.detectFace.mockReturnValue(face(0, -25))
        run(game.tick, 4200)
        expect(game.lastState().position.y).toBeLessThan(y0 - 2)
    })

    it('olhar para o lado para de subir, e voltar a olhar para cima exige esperar de novo', async () => {
        const game = await playing()
        gripWall(game)
        game.detectFace.mockReturnValue(face(0, 25))
        run(game.tick, 4200)
        expect(game.controller.getSnapshot().headClimb.climbing).toBe(true)
        game.detectFace.mockReturnValue(face(40, 25))
        run(game.tick, 600)
        expect(game.controller.getSnapshot().headClimb.climbing).toBe(false)
        const y = game.lastState().position.y
        run(game.tick, 1500)
        expect(Math.abs(game.lastState().position.y - y)).toBeLessThan(0.5)
        // Volta a olhar para cima: ainda precisa esperar.
        game.detectFace.mockReturnValue(face(0, 25))
        run(game.tick, 1000)
        expect(game.controller.getSnapshot().headClimb.climbing).toBe(false)
        run(game.tick, 3500)
        expect(game.controller.getSnapshot().headClimb.climbing).toBe(true)
    })

    it('olhando para o lado, fica agarrado admirando a paisagem (a mão aberta segura)', async () => {
        const game = await playing()
        gripWall(game)
        game.detectFace.mockReturnValue(face(40, 0))
        run(game.tick, 20_000)
        expect(game.controller.getSnapshot().hud.gripped).toBe(true)
    })

    it('na direção do olhar Automática, olhar para cima não escala', async () => {
        const game = await playing()
        gripWall(game)
        game.controller.setLookMode('auto')
        const y0 = game.lastState().position.y
        game.detectFace.mockReturnValue(face(0, 25))
        run(game.tick, 5000)
        expect(game.controller.getSnapshot().headClimb.climbing).toBe(false)
        expect(Math.abs(game.lastState().position.y - y0)).toBeLessThan(0.5)
    })

    it('fora do agarre, olhar para cima não conta tempo de escalada', async () => {
        const game = await playing()
        game.detectFace.mockReturnValue(face(0, 0))
        run(game.tick, 600)
        game.detectFace.mockReturnValue(face(0, 25))
        run(game.tick, 3000)
        expect(game.controller.getSnapshot().headClimb.intent).toBeNull()
    })
})
