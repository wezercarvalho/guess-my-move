import { type City, type SwingState } from '@guess-my-move/swing'
import { describe, expect, it, vi } from 'vitest'

import { type HandTracker, type TrackedHand } from '../tracker/handTracker.js'
import { type SwingRenderer } from './cityRenderer.js'
import { SwingController, type SwingEnv } from './swingController.js'

/**
 * Cidade com uma parede-paredão logo à frente do ponto de partida (olhando para -Z): o
 * jogador lança a teia, puxa e bate na fachada, onde pode agarrar. Prédio largo e alto para
 * o contato ser fácil de alcançar.
 */
const city: City = {
    version: 1,
    name: 'teste',
    attribution: 'Dados do mapa de teste',
    bounds: { minX: -400, maxX: 400, minZ: -400, maxZ: 400 },
    buildings: [{ height: 400, ring: [-200, -140, 200, -140, 200, -60, -200, -60] }],
    roads: [],
}

/** Palma aberta com a geometria completa (dedos esticados), no x pedido. */
const palm = (x = 0.5): TrackedHand => {
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

/** Punho fechado (os quatro dedos dobrados, pontas perto do pulso) no x pedido. */
const fist = (x = 0.5): TrackedHand => {
    const points = Array.from({ length: 21 }, () => ({ x, y: 0.8 }))
    const finger = (first: number, fx: number) => {
        points[first] = { x: fx, y: 0.6 }
        points[first + 1] = { x: fx, y: 0.62 }
        points[first + 2] = { x: fx, y: 0.64 }
        points[first + 3] = { x: fx, y: 0.66 }
    }
    finger(5, x - 0.06)
    finger(9, x)
    finger(13, x + 0.06)
    finger(17, x + 0.12)
    points[4] = { x: x - 0.02, y: 0.66 }
    return { landmarks: points }
}

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
    const tracker = { delegate: 'CPU' as const, detect: vi.fn<HandTracker['detect']>(() => null), detectAll, close: vi.fn() }
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
    return { controller, detectAll, tick, press, release, lastState }
}

/** Leva o jogador até encostar na fachada: lança a teia (Espaço) e puxa (C), religando se soltar. */
function reachWall(
    controller: SwingController,
    tick: (ms?: number) => void,
    press: (k: string) => void,
    lastState: () => SwingState,
): boolean {
    press(' ')
    press('c')
    for (let i = 0; i < 6000; i++) {
        tick()
        if (lastState().touchingWall) return true
        // Se a teia soltou (errou ou chegou ao ponto), relança.
        if (!controller.getSnapshot().hud.webAttached) press(' ')
    }
    return false
}

describe('SwingController — agarre à parede', () => {
    it('V sozinho, sem contato com a parede, não agarra', async () => {
        const { controller, press, tick } = await playing()
        tick()
        press('v')
        for (let i = 0; i < 20; i++) tick()
        expect(controller.getSnapshot().hud.gripped).toBe(false)
    })

    it('encosta na parede e, com V, agarra; as setas sobem', async () => {
        const { controller, press, release, tick, lastState } = await playing()
        tick()
        expect(reachWall(controller, tick, press, lastState), 'não encostou na parede').toBe(true)
        // Ainda prensado na parede (teia + C puxando), agarra com V e só então solta a teia.
        press('v')
        tick()
        release(' ')
        release('c')
        for (let i = 0; i < 10; i++) tick()
        expect(controller.getSnapshot().hud.gripped).toBe(true)
        const y = lastState().position.y
        press('ArrowUp')
        for (let i = 0; i < 60; i++) tick()
        expect(lastState().position.y).toBeGreaterThan(y)
    })

    it('agarrado, soltar V larga a parede', async () => {
        const { controller, press, release, tick, lastState } = await playing()
        tick()
        expect(reachWall(controller, tick, press, lastState)).toBe(true)
        press('v')
        tick()
        release(' ')
        release('c')
        for (let i = 0; i < 10; i++) tick()
        expect(controller.getSnapshot().hud.gripped).toBe(true)
        release('v')
        for (let i = 0; i < 40; i++) tick()
        expect(controller.getSnapshot().hud.gripped).toBe(false)
    })

    it('a palma aberta em contato com a parede agarra (não só solta a teia)', async () => {
        const { controller, detectAll, press, tick, lastState } = await playing()
        tick()
        expect(reachWall(controller, tick, press, lastState)).toBe(true)
        // Prensado na parede, a palma aberta de uma mão (x cru grande) agarra.
        detectAll.mockReturnValue([palm(0.8)])
        for (let i = 0; i < 10; i++) tick()
        expect(controller.getSnapshot().hud.gripped).toBe(true)
    })

    it('agarrado pela palma, o punho fechado segurado solta', async () => {
        const { controller, detectAll, press, tick, lastState } = await playing()
        tick()
        expect(reachWall(controller, tick, press, lastState)).toBe(true)
        detectAll.mockReturnValue([palm(0.8)])
        for (let i = 0; i < 10; i++) tick()
        expect(controller.getSnapshot().hud.gripped).toBe(true)
        // Fecha o punho e segura: solta o agarre depois do tempo.
        detectAll.mockReturnValue([fist(0.8)])
        for (let i = 0; i < 40; i++) tick()
        expect(controller.getSnapshot().hud.gripped).toBe(false)
    })

    it('expõe a palma aberta, o punho e o sinal de escalada na depuração', async () => {
        const { controller, detectAll, tick } = await playing()
        detectAll.mockReturnValue([palm(0.8)])
        tick(150)
        tick(150)
        const [reading] = controller.getSnapshot().handDebug
        expect(reading?.openPalm).toBe(true)
        expect(reading?.fist).toBe(false)
        detectAll.mockReturnValue([fist(0.8)])
        tick(150)
        const [closed] = controller.getSnapshot().handDebug
        expect(closed?.openPalm).toBe(false)
        expect(closed?.fist).toBe(true)
    })
})
