import { type City, type SwingState } from '@guess-my-move/swing'
import { describe, expect, it, vi } from 'vitest'

import { type HandTracker, type TrackedHand } from '../tracker/handTracker.js'
import { type SwingRenderer } from './cityRenderer.js'
import { SwingController, type SwingEnv } from './swingController.js'

/** Prédios altos dos dois lados, 40 a 90 m à frente da origem (olhando para -Z). */
const city: City = {
    version: 1,
    name: 'teste',
    attribution: 'Dados do mapa de teste',
    bounds: { minX: -300, maxX: 300, minZ: -300, maxZ: 300 },
    buildings: [
        { height: 400, ring: [-80, -120, -20, -120, -20, -60, -80, -60] },
        { height: 400, ring: [20, -120, 80, -120, 80, -60, 20, -60] },
    ],
    roads: [],
}

const WEB = { name: 'ILoveYou', score: 0.9 }

/** Mão simulada: todos os pontos em `x` (lado cru da imagem), com o gesto do reconhecedor. */
const hand = (x: number, gesture?: TrackedHand['gesture']): TrackedHand => ({
    landmarks: Array.from({ length: 21 }, () => ({ x, y: 0.5 })),
    ...(gesture ? { gesture } : {}),
})

/** Mão de palma aberta com a geometria completa (dedos esticados para cima). */
const palm = (): TrackedHand => {
    const points = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.8 }))
    const finger = (first: number, x: number) => {
        points[first] = { x, y: 0.6 }
        points[first + 1] = { x, y: 0.53 }
        points[first + 2] = { x, y: 0.47 }
        points[first + 3] = { x, y: 0.4 }
    }
    finger(5, 0.44)
    finger(9, 0.5)
    finger(13, 0.56)
    finger(17, 0.62)
    points[4] = { x: 0.26, y: 0.6 }
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
    // Contexto 2D de mentira: aceita qualquer chamada de desenho.
    const context = new Proxy({}, { get: () => vi.fn(), set: () => true })
    const keys = new EventTarget()
    const detectAll = vi.fn<NonNullable<HandTracker['detectAll']>>(() => [])
    const tracker = {
        delegate: 'CPU' as const,
        detect: vi.fn<HandTracker['detect']>(() => null),
        detectAll,
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
    const lastState = (): SwingState => {
        const call = renderer.render.mock.calls.at(-1) as [SwingState] | undefined
        if (!call) throw new Error('nenhum quadro desenhado')
        return call[0]
    }
    controller.attach(surfaces)
    await flush()
    controller.setCamera(true)
    await flush()
    return { controller, detectAll, tick, press, lastState, renderer }
}

/** Dá alguns quadros para o gatilho confirmar o gesto. */
function settle(tick: (ms?: number) => void) {
    for (let i = 0; i < 4; i++) tick()
    tick(150)
}

describe('SwingController com as duas mãos', () => {
    it('a mão esquerda (esquerda da tela espelhada) lança a teia à esquerda', async () => {
        const { controller, detectAll, tick, lastState } = await playing()
        // x cru grande = esquerda na tela espelhada.
        detectAll.mockReturnValue([hand(0.8, WEB)])
        settle(tick)
        const snapshot = controller.getSnapshot()
        expect(snapshot.held).toEqual({ left: true, right: false })
        expect(snapshot.hud.webAttached).toBe(true)
        expect(lastState().webs[0]?.side).toBe(-1)
    })

    it('a mão direita lança a teia à direita', async () => {
        const { controller, detectAll, tick, lastState } = await playing()
        detectAll.mockReturnValue([hand(0.2, WEB)])
        settle(tick)
        expect(controller.getSnapshot().held).toEqual({ left: false, right: true })
        expect(lastState().webs[0]?.side).toBe(1)
    })

    it('lançar com a outra mão depois deixa as duas teias presas', async () => {
        const { controller, detectAll, tick, lastState } = await playing()
        detectAll.mockReturnValue([hand(0.8, WEB)])
        settle(tick)
        expect(lastState().webs.map((web) => web.side)).toEqual([-1])
        detectAll.mockReturnValue([hand(0.8, WEB), hand(0.2, WEB)])
        settle(tick)
        expect(lastState().webs.map((web) => web.side).sort((a, b) => a - b)).toEqual([-1, 1])
        expect(controller.getSnapshot().hud.webSides.slice().sort((a, b) => a - b)).toEqual([-1, 1])
        expect(controller.getSnapshot().hud.webs).toBe(2)
    })

    it('a mão que sai da imagem solta só a teia dela, depois da tolerância', async () => {
        const { detectAll, tick, lastState } = await playing()
        detectAll.mockReturnValue([hand(0.8, WEB), hand(0.2, WEB)])
        settle(tick)
        detectAll.mockReturnValue([hand(0.2, WEB)])
        tick(350)
        tick(350)
        expect(lastState().webs.map((web) => web.side)).toEqual([1])
    })

    it('as duas mãos com o gesto contam as duas', async () => {
        const { controller, detectAll, tick } = await playing()
        detectAll.mockReturnValue([hand(0.2, WEB), hand(0.8, WEB)])
        settle(tick)
        const snapshot = controller.getSnapshot()
        expect(snapshot.held).toEqual({ left: true, right: true })
        expect(snapshot.handsVisible).toBe(2)
    })

    it('o punho de uma mão puxa só a teia dela', async () => {
        const { detectAll, tick, lastState } = await playing()
        detectAll.mockReturnValue([hand(0.8, WEB), hand(0.2, WEB)])
        settle(tick)
        detectAll.mockReturnValue([hand(0.8, { name: 'Closed_Fist', score: 0.9 }), hand(0.2, WEB)])
        tick(150)
        const webs = lastState().webs
        expect(webs.find((web) => web.side === -1)?.pulling).toBe(true)
        expect(webs.find((web) => web.side === 1)?.pulling).toBeFalsy()
    })

    it('a palma aberta de uma mão solta só a teia dela', async () => {
        const { detectAll, tick, lastState } = await playing()
        detectAll.mockReturnValue([hand(0.8, WEB), hand(0.2, WEB)])
        settle(tick)
        // A palma fica no lado esquerdo da tela espelhada (x cru grande).
        const open = palm()
        const shifted: TrackedHand = {
            landmarks: open.landmarks.map((point) => ({ ...point, x: point.x + 0.3 })),
        }
        detectAll.mockReturnValue([shifted, hand(0.2, WEB)])
        tick()
        tick(150)
        expect(lastState().webs.map((web) => web.side)).toEqual([1])
    })

    it('o punho com a teia presa puxa; a pose volta a só segurar', async () => {
        const { controller, detectAll, tick } = await playing()
        detectAll.mockReturnValue([hand(0.8, WEB)])
        settle(tick)
        expect(controller.getSnapshot().pulling).toBe(false)
        detectAll.mockReturnValue([hand(0.8, { name: 'Closed_Fist', score: 0.9 })])
        tick(150)
        const pulled = controller.getSnapshot()
        expect(pulled.pulling).toBe(true)
        expect(pulled.gestureHeld).toBe(true)
        detectAll.mockReturnValue([hand(0.8, WEB)])
        tick(150)
        expect(controller.getSnapshot().pulling).toBe(false)
    })

    it('a palma aberta solta a teia', async () => {
        const { controller, detectAll, tick } = await playing()
        detectAll.mockReturnValue([hand(0.8, WEB)])
        settle(tick)
        expect(controller.getSnapshot().gestureHeld).toBe(true)
        detectAll.mockReturnValue([palm()])
        tick()
        tick(150)
        expect(controller.getSnapshot().gestureHeld).toBe(false)
        expect(controller.getSnapshot().hud.webAttached).toBe(false)
    })

    it('o rótulo Open_Palm sem a geometria não solta a teia', async () => {
        const { controller, detectAll, tick } = await playing()
        detectAll.mockReturnValue([hand(0.8, WEB)])
        settle(tick)
        detectAll.mockReturnValue([hand(0.8, { name: 'Open_Palm', score: 0.99 })])
        tick()
        tick(150)
        expect(controller.getSnapshot().gestureHeld).toBe(true)
    })

    it('as mãos não giram a câmera', async () => {
        const { detectAll, tick, lastState } = await playing()
        detectAll.mockReturnValue([hand(0.15)])
        for (let i = 0; i < 24; i++) tick()
        expect(lastState().yaw).toBe(0)
    })

    it('expõe a leitura de cada mão para a depuração', async () => {
        const { controller, detectAll, tick } = await playing()
        detectAll.mockReturnValue([palm()])
        tick(150)
        const [reading] = controller.getSnapshot().handDebug
        expect(reading?.signal).toBe('Open_Palm')
        expect(reading?.metrics?.index).toBeGreaterThan(1.5)
        detectAll.mockReturnValue([])
        tick(700)
        tick(150)
        expect(controller.getSnapshot().handDebug).toEqual([])
    })

    it('antes de lançar, projeta na tela onde a teia prende de cada lado', async () => {
        const { detectAll, tick, renderer } = await playing()
        detectAll.mockReturnValue([hand(0.5)])
        tick()
        tick()
        expect(renderer.project).toHaveBeenCalled()
        expect(renderer.project.mock.calls.length).toBeGreaterThanOrEqual(2)
    })

    it('mostra a mira só do lado que está sem teia', async () => {
        const { detectAll, tick, renderer } = await playing()
        detectAll.mockReturnValue([hand(0.8, WEB)])
        settle(tick)
        renderer.project.mockClear()
        tick()
        expect(renderer.project).toHaveBeenCalledTimes(1)
    })

    it('com as duas teias presas, deixa de mostrar as miras', async () => {
        const { detectAll, tick, renderer } = await playing()
        detectAll.mockReturnValue([hand(0.8, WEB), hand(0.2, WEB)])
        settle(tick)
        renderer.project.mockClear()
        tick()
        expect(renderer.project).not.toHaveBeenCalled()
    })

    it('as teclas Z e X lançam à esquerda e à direita', async () => {
        const { press, tick, lastState } = await playing()
        press('z')
        tick()
        tick()
        expect(lastState().webs[0]?.side).toBe(-1)
    })

    it('indica a próxima ação para a tela', async () => {
        const { controller, tick } = await playing()
        tick()
        expect(controller.getSnapshot().cue).toBe('start')
    })
})
