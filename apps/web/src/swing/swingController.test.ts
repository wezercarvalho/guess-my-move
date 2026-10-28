import { type City, type SwingState } from '@guess-my-move/swing'
import { describe, expect, it, vi } from 'vitest'

import { type HandTracker, type TrackedHand } from '../tracker/handTracker.js'
import { type SwingRenderer } from './cityRenderer.js'
import { SwingController, type SwingEnv } from './swingController.js'

/** Um prédio alto 40 m à frente do ponto de partida (origem, olhando para -Z). */
const city: City = {
    version: 1,
    name: 'teste',
    attribution: 'Dados do mapa de teste',
    bounds: { minX: -200, maxX: 200, minZ: -200, maxZ: 200 },
    buildings: [{ height: 300, ring: [-10, -50, 10, -50, 10, -40, -10, -40] }],
    roads: [],
}

const hand = (x: number, gesture?: TrackedHand['gesture']): TrackedHand => ({
    landmarks: Array.from({ length: 21 }, () => ({ x, y: 0.5 })),
    ...(gesture ? { gesture } : {}),
})

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

function setup(overrides: Partial<SwingEnv> = {}) {
    let time = 0
    let pending: (() => void) | null = null
    const renderer = { resize: vi.fn(), render: vi.fn(), dispose: vi.fn() }
    const keys = new EventTarget()
    const tracker = {
        delegate: 'CPU' as const,
        detect: vi.fn<HandTracker['detect']>(() => null),
        close: vi.fn(),
    }
    const env: SwingEnv = {
        createTracker: vi.fn(() => Promise.resolve(tracker)),
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
        ...overrides,
    }
    const video = { readyState: 4, videoWidth: 640, videoHeight: 480, currentTime: 0 }
    const surfaces = {
        getVideo: () => video as HTMLVideoElement,
        getOverlay: () => document.createElement('canvas'),
        getScene: () => document.createElement('canvas'),
        getEffects: () => document.createElement('canvas'),
    }
    const controller = new SwingController(env)
    /** Avança `ms` e roda o quadro pendente, como o `requestAnimationFrame`. */
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
    return { controller, env, renderer, tracker, surfaces, tick, press, release, lastState }
}

async function playing(overrides: Partial<SwingEnv> = {}) {
    const game = setup(overrides)
    game.controller.attach(game.surfaces)
    await flush()
    return game
}

describe('SwingController', () => {
    it('carrega a cidade, cria o 3D e passa a jogar', async () => {
        const { controller, env, renderer, tick } = await playing()
        expect(env.createRenderer).toHaveBeenCalledTimes(1)
        tick()
        tick()
        tick(150)
        expect(renderer.render).toHaveBeenCalled()
        expect(controller.getSnapshot().phase).toBe('playing')
        expect(controller.getSnapshot().attribution).toBe('Dados do mapa de teste')
    })

    it('mostra o erro quando a cidade não carrega', async () => {
        const { controller } = await playing({ loadCity: () => Promise.reject(new Error('404')) })
        expect(controller.getSnapshot().phase).toBe('error')
        expect(controller.getSnapshot().failure).toMatch(/cidade/)
    })

    it('mostra o erro quando o 3D não inicia', async () => {
        const { controller } = await playing({
            createRenderer: () => {
                throw new Error('sem WebGL')
            },
        })
        expect(controller.getSnapshot().phase).toBe('error')
        expect(controller.getSnapshot().failure).toMatch(/3D/)
    })

    it('Espaço lança a teia e soltar a tecla a solta', async () => {
        const { controller, tick, press, release } = await playing()
        tick()
        press(' ')
        tick()
        tick()
        tick(150)
        expect(controller.getSnapshot().hud.webs).toBe(1)
        expect(controller.getSnapshot().hud.webAttached).toBe(true)
        release(' ')
        tick()
        tick(150)
        expect(controller.getSnapshot().hud.webAttached).toBe(false)
    })

    it('registra o lançamento que errou quando não há prédio na mira', async () => {
        const { controller, tick, press, release } = await playing()
        tick()
        press('ArrowDown')
        for (let i = 0; i < 80; i++) tick()
        release('ArrowDown')
        press(' ')
        tick()
        tick()
        tick(150)
        expect(controller.getSnapshot().lastThrow).toBe('miss')
        expect(controller.getSnapshot().hud.webAttached).toBe(false)
    })

    it('registra o lançamento que prendeu', async () => {
        const { controller, tick, press } = await playing()
        tick()
        press(' ')
        tick()
        tick()
        tick(150)
        expect(controller.getSnapshot().lastThrow).toBe('hit')
    })

    it('as setas giram a câmera', async () => {
        const { tick, press, lastState } = await playing()
        tick()
        press('ArrowRight')
        for (let i = 0; i < 30; i++) tick()
        expect(lastState().yaw).toBeGreaterThan(0.5)
    })

    it('ignora outras teclas', async () => {
        const { tick, press, lastState } = await playing()
        tick()
        press('a')
        for (let i = 0; i < 10; i++) tick()
        expect(lastState().yaw).toBe(0)
    })

    it('o gesto ILoveYou da câmera lança a teia', async () => {
        const { controller, tracker, tick } = await playing()
        tracker.detect.mockReturnValue(hand(0.5, { name: 'ILoveYou', score: 0.9 }))
        controller.setCamera(true)
        await flush()
        tick()
        tick()
        tick()
        tick(150)
        const snapshot = controller.getSnapshot()
        expect(snapshot.trackerStatus).toBe('ready')
        expect(snapshot.handVisible).toBe(true)
        expect(snapshot.gestureHeld).toBe(true)
        expect(snapshot.hud.webAttached).toBe(true)
    })

    it('a mão à esquerda da imagem crua (direita do usuário) gira para a direita', async () => {
        const { controller, tracker, tick, lastState } = await playing()
        tracker.detect.mockReturnValue(hand(0.2))
        controller.setCamera(true)
        await flush()
        tick()
        for (let i = 0; i < 20; i++) tick()
        expect(lastState().yaw).toBeGreaterThan(0)
    })

    it('mão perdida solta a teia depois da tolerância', async () => {
        const { controller, tracker, tick } = await playing()
        tracker.detect.mockReturnValue(hand(0.5, { name: 'ILoveYou', score: 0.9 }))
        controller.setCamera(true)
        await flush()
        for (let i = 0; i < 4; i++) tick()
        tracker.detect.mockReturnValue(null)
        for (let i = 0; i < 30; i++) tick()
        tick(150)
        expect(controller.getSnapshot().gestureHeld).toBe(false)
        expect(controller.getSnapshot().handVisible).toBe(false)
    })

    it('se o detector falha, o teclado continua jogando', async () => {
        const { controller, tick, press } = await playing({
            createTracker: () => Promise.reject(new Error('sem modelo')),
        })
        controller.setCamera(true)
        await flush()
        expect(controller.getSnapshot().trackerStatus).toBe('error')
        expect(controller.getSnapshot().trackerFailure).toBe('sem modelo')
        tick()
        press(' ')
        tick()
        tick()
        tick(150)
        expect(controller.getSnapshot().hud.webs).toBe(1)
    })

    it('restart volta ao início e zera as teias', async () => {
        const { controller, tick, press } = await playing()
        tick()
        press(' ')
        tick()
        tick()
        tick(150)
        controller.restart()
        expect(controller.getSnapshot().hud.webs).toBe(0)
    })

    it('detach libera o 3D e o detector e para de ouvir o teclado', async () => {
        const { controller, renderer, tracker, env, tick, press } = await playing()
        controller.setCamera(true)
        await flush()
        controller.detach()
        expect(renderer.dispose).toHaveBeenCalledTimes(1)
        expect(tracker.close).toHaveBeenCalledTimes(1)
        expect(env.cancelFrame).toHaveBeenCalled()
        press(' ')
        tick()
        tick(150)
        expect(controller.getSnapshot().hud.webs).toBe(0)
    })

    it('resize repassa o tamanho ao 3D, antes e depois de criá-lo', async () => {
        const game = setup()
        game.controller.resize(800, 450)
        game.controller.attach(game.surfaces)
        await flush()
        expect(game.renderer.resize).toHaveBeenCalledWith(800, 450)
        game.controller.resize(1024, 576)
        expect(game.renderer.resize).toHaveBeenLastCalledWith(1024, 576)
    })
})
