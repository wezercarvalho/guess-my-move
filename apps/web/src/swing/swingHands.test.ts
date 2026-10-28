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
        expect(lastState().web?.side).toBe(-1)
    })

    it('a mão direita lança a teia à direita', async () => {
        const { controller, detectAll, tick, lastState } = await playing()
        detectAll.mockReturnValue([hand(0.2, WEB)])
        settle(tick)
        expect(controller.getSnapshot().held).toEqual({ left: false, right: true })
        expect(lastState().web?.side).toBe(1)
    })

    it('trocar de mão lança uma teia nova do outro lado', async () => {
        const { controller, detectAll, tick, lastState } = await playing()
        detectAll.mockReturnValue([hand(0.8, WEB)])
        settle(tick)
        detectAll.mockReturnValue([hand(0.2, WEB)])
        settle(tick)
        // A mão esquerda sai da imagem: depois da tolerância só a direita segura a teia.
        tick(150)
        tick(150)
        expect(lastState().web?.side).toBe(1)
        expect(controller.getSnapshot().hud.webs).toBeGreaterThanOrEqual(2)
    })

    it('as duas mãos com o gesto contam as duas e lançam ao centro', async () => {
        const { controller, detectAll, tick } = await playing()
        detectAll.mockReturnValue([hand(0.2, WEB), hand(0.8, WEB)])
        settle(tick)
        const snapshot = controller.getSnapshot()
        expect(snapshot.held).toEqual({ left: true, right: true })
        expect(snapshot.handsVisible).toBe(2)
    })

    it('a mão que lança a teia não gira a câmera; a outra mão gira', async () => {
        const web = await playing()
        web.detectAll.mockReturnValue([hand(0.15, WEB)])
        settle(web.tick)
        for (let i = 0; i < 20; i++) web.tick()
        const steered = await playing()
        steered.detectAll.mockReturnValue([hand(0.15)])
        for (let i = 0; i < 24; i++) steered.tick()
        expect(Math.abs(web.lastState().yaw)).toBeLessThan(0.3)
        expect(steered.lastState().yaw).toBeGreaterThan(0.5)
    })

    it('antes de lançar, projeta na tela onde a teia prende de cada lado', async () => {
        const { detectAll, tick, renderer } = await playing()
        detectAll.mockReturnValue([hand(0.5)])
        tick()
        tick()
        expect(renderer.project).toHaveBeenCalled()
        expect(renderer.project.mock.calls.length).toBeGreaterThanOrEqual(2)
    })

    it('com a teia presa, deixa de mostrar as miras', async () => {
        const { detectAll, tick, renderer } = await playing()
        detectAll.mockReturnValue([hand(0.8, WEB)])
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
        expect(lastState().web?.side).toBe(-1)
    })

    it('indica a próxima ação para a tela', async () => {
        const { controller, tick } = await playing()
        tick()
        expect(controller.getSnapshot().cue).toBe('start')
    })
})
