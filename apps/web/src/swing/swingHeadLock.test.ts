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

/** Palma aberta com a geometria completa (dedos esticados), no x pedido. Dados sintéticos. */
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

/**
 * A mesma palma girada 90° para a esquerda em torno do pulso: dedos de lado e dedão para
 * baixo, como na foto do maintainer. Dados sintéticos; o pulso fica em (x, 0.45).
 */
const thumbDown = (x = 0.2): TrackedHand => {
    const source = palm(x).landmarks
    const wrist = source[0] ?? { x, y: 0.8 }
    return {
        landmarks: source.map((point) => ({
            x: x + (point.y - wrist.y),
            y: 0.45 - (point.x - wrist.x),
        })),
    }
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

const run = (tick: (ms?: number) => void, ms: number) => {
    for (let elapsed = 0; elapsed < ms; elapsed += 16) tick()
}

/** Calibra o rosto no neutro e vira a cabeça `yaw` graus até o olhar estabilizar; devolve o olhar. */
function turnHead({ detectFace, tick, lastState }: Playing, yaw: number): number {
    detectFace.mockReturnValue(face(0))
    run(tick, 400)
    detectFace.mockReturnValue(face(yaw))
    run(tick, 2000)
    return lastState().yaw
}

/** Lança a teia, puxa e bate na fachada, com Espaço e C ainda apertados. Calibra o rosto no neutro. */
function reachWall({ controller, detectFace, tick, press, lastState }: Playing) {
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
}

/** Encostado na fachada, a palma aberta agarra; só então solta as teclas. */
function gripWall(game: Playing) {
    reachWall(game)
    game.detectAll.mockReturnValue([palm()])
    for (let i = 0; i < 4; i++) game.tick()
    game.release(' ')
    game.release('c')
    for (let i = 0; i < 30; i++) game.tick()
    if (!game.controller.getSnapshot().hud.gripped) throw new Error('não agarrou')
}

describe('SwingController — trava da direção do olhar (CQ-012)', () => {
    it('a pose do dedão para baixo não é palma aberta nem sinal de teia, e o painel a mostra', async () => {
        const { controller, detectAll, tick } = await playing()
        detectAll.mockReturnValue([palm(0.8)])
        run(tick, 200)
        expect(controller.getSnapshot().handDebug[0]?.openPalm).toBe(true)
        expect(controller.getSnapshot().handDebug[0]?.lockPose).toBe(false)
        detectAll.mockReturnValue([thumbDown(0.5)])
        run(tick, 200)
        const hand = controller.getSnapshot().handDebug[0]
        expect(hand?.openPalm).toBe(false)
        expect(hand?.lockPose).toBe(true)
        expect(hand?.signal).toBeNull()
    })

    it('com o gesto, a direção trava; ao tirar a mão, a cabeça volta a seguir na hora, a partir dela', async () => {
        const game = await playing()
        const { controller, detectAll, detectFace, tick, lastState } = game
        tick()
        const before = lastState().yaw
        const turned = turnHead(game, 25)
        expect(turned).toBeGreaterThan(before + 0.2)

        // Faz o gesto com a cabeça ainda virada.
        detectAll.mockReturnValue([thumbDown()])
        run(tick, 400)
        expect(controller.getSnapshot().headLock.mode).toBe('locked')

        // Volta o rosto para a tela com o gesto valendo: a câmera fica onde estava.
        detectFace.mockReturnValue(face(0))
        run(tick, 1000)
        expect(lastState().yaw).toBeCloseTo(turned, 1)

        // Tira a mão com o rosto centralizado: volta a seguir a cabeça, sem esperar, e a câmera fica.
        detectAll.mockReturnValue([])
        run(tick, 400)
        expect(controller.getSnapshot().headLock.mode).toBe('following')
        expect(lastState().yaw).toBeCloseTo(turned, 1)

        // Esquerda e direita voltam a girar a câmera, a partir da direção travada.
        detectFace.mockReturnValue(face(25))
        run(tick, 2000)
        expect(lastState().yaw).toBeGreaterThan(turned + 0.2)
        detectFace.mockReturnValue(face(-25))
        run(tick, 2000)
        expect(lastState().yaw).toBeLessThan(turned - 0.2)
    })

    it('sem o gesto, voltar o rosto ao centro devolve a câmera (nada trava)', async () => {
        const game = await playing()
        const { controller, detectFace, tick, lastState } = game
        tick()
        const before = lastState().yaw
        const turned = turnHead(game, 25)
        detectFace.mockReturnValue(face(0))
        run(tick, 2000)
        expect(controller.getSnapshot().headLock.mode).toBe('following')
        expect(lastState().yaw).toBeLessThan(turned - 0.2)
        expect(lastState().yaw).toBeCloseTo(before, 1)
    })

    it('tirar a mão com a cabeça ainda virada: a câmera volta a seguir a cabeça, somando à direção travada', async () => {
        const game = await playing()
        const { controller, detectAll, detectFace, tick, lastState } = game
        const turned = turnHead(game, 25)
        detectAll.mockReturnValue([thumbDown()])
        run(tick, 400)
        detectAll.mockReturnValue([])
        detectFace.mockReturnValue(face(40))
        run(tick, 2000)
        expect(controller.getSnapshot().headLock.mode).toBe('following')
        expect(lastState().yaw).toBeGreaterThan(turned + 0.2)
    })

    it('travada, o acompanhamento mira o rumo mais a direção travada, mesmo sem rosto à vista', async () => {
        const game = await playing()
        const { controller, detectAll, detectFace, tick, press, lastState } = game
        // Voa balançando na teia (Espaço segurado), para o jogador manter velocidade e o
        // acompanhamento automático puxar o olhar para o rumo.
        press(' ')
        detectFace.mockReturnValue(face(0))
        run(tick, 400)
        detectFace.mockReturnValue(face(25))
        run(tick, 700)
        detectAll.mockReturnValue([thumbDown()])
        run(tick, 400)
        expect(controller.getSnapshot().headLock.mode).toBe('locked')
        expect(controller.getSnapshot().headDebug.yawDeg).toBeGreaterThan(20)
        // O rosto sai do quadro (cabeça muito virada): a direção travada segue firme, em relação ao rumo.
        detectFace.mockReturnValue(null)
        run(tick, 1500)
        expect(controller.getSnapshot().headLock.mode).toBe('locked')
        const { yaw, velocity } = lastState()
        expect(Math.hypot(velocity.x, velocity.z)).toBeGreaterThan(8)
        const heading = Math.atan2(velocity.x, -velocity.z)
        let relative = yaw - heading
        while (relative > Math.PI) relative -= 2 * Math.PI
        while (relative < -Math.PI) relative += 2 * Math.PI
        // Sem o viés o olhar voltaria ao rumo (relativo ~0); com ele fica ao lado do rumo.
        expect(relative).toBeGreaterThan(0.3)
    })

    it('"Centralizar" encerra a trava e zera a direção travada', async () => {
        const game = await playing()
        const { controller, detectAll, detectFace, tick, lastState } = game
        tick()
        const before = lastState().yaw
        turnHead(game, 25)
        detectAll.mockReturnValue([thumbDown()])
        run(tick, 400)
        detectFace.mockReturnValue(face(0))
        run(tick, 500)
        detectAll.mockReturnValue([])
        controller.recenterHead()
        run(tick, 2000)
        expect(controller.getSnapshot().headLock.mode).toBe('following')
        expect(lastState().yaw).toBeCloseTo(before, 1)
    })

    it('um gesto passageiro (menos que o tempo mínimo) não trava', async () => {
        const game = await playing()
        const { controller, detectAll, tick } = game
        turnHead(game, 25)
        detectAll.mockReturnValue([thumbDown()])
        run(tick, 100)
        detectAll.mockReturnValue([])
        run(tick, 400)
        expect(controller.getSnapshot().headLock.mode).toBe('following')
    })

    it('em Automática o gesto não trava nada', async () => {
        const { controller, detectAll, tick } = await playing()
        controller.setLookMode('auto')
        detectAll.mockReturnValue([thumbDown()])
        run(tick, 600)
        expect(controller.getSnapshot().headLock.mode).toBe('following')
    })

    it('encostado na parede, a mão no gesto de travar NÃO agarra (a palma agarra)', async () => {
        const game = await playing()
        reachWall(game)
        game.detectAll.mockReturnValue([thumbDown()])
        run(game.tick, 600)
        expect(game.controller.getSnapshot().hud.gripped).toBe(false)
        game.detectAll.mockReturnValue([palm()])
        run(game.tick, 300)
        expect(game.controller.getSnapshot().hud.gripped).toBe(true)
    })

    it('já agarrado, a mão que passa ao gesto de travar não derruba o agarre', async () => {
        const game = await playing()
        gripWall(game)
        game.detectAll.mockReturnValue([thumbDown(0.5)])
        run(game.tick, 1500)
        expect(game.controller.getSnapshot().hud.gripped).toBe(true)
        // Sem nenhuma mão o agarre ainda solta, como antes (a saída continua à mão).
        game.detectAll.mockReturnValue([])
        run(game.tick, 1500)
        expect(game.controller.getSnapshot().hud.gripped).toBe(false)
    })

    it('a escalada pelo olhar ignora a direção travada: só o olhar vivo conta', async () => {
        const game = await playing()
        gripWall(game)
        const { controller, detectAll, detectFace, tick, lastState } = game
        const y0 = lastState().position.y
        // Olha para cima por menos que a espera de escalada, e trava essa direção com a outra mão.
        detectFace.mockReturnValue(face(0, 20))
        run(tick, 600)
        detectAll.mockReturnValue([palm(0.8), thumbDown(0.2)])
        run(tick, 400)
        expect(controller.getSnapshot().headLock.mode).toBe('locked')
        // Volta o rosto à tela e tira a mão do gesto; segura só a palma que agarra.
        detectFace.mockReturnValue(face(0, 0))
        detectAll.mockReturnValue([palm(0.8)])
        run(tick, 4000)
        expect(controller.getSnapshot().headLock.mode).toBe('following')
        expect(controller.getSnapshot().headClimb.intent).toBeNull()
        expect(controller.getSnapshot().hud.gripped).toBe(true)
        expect(Math.abs(lastState().position.y - y0)).toBeLessThan(0.5)
    })
})
