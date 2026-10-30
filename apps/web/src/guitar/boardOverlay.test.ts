import { DEFAULT_PLACEMENT, FingerTracker } from '@guess-my-move/guitar'
import { describe, expect, it, vi } from 'vitest'

import { type BoardView, drawBoardOverlay } from './boardOverlay.js'

/** Contexto 2D gravador: guarda chamadas e estilos usados. */
function recorder() {
    const calls: { name: string; args: unknown[] }[] = []
    const target: Record<string, unknown> = {}
    const context = new Proxy(target, {
        get(_object, name: string) {
            return (...args: unknown[]) => {
                calls.push({ name, args })
            }
        },
        set(_object, name: string, value: unknown) {
            target[name] = value
            return true
        },
    })
    return { context: context as unknown as CanvasRenderingContext2D, calls }
}

function setup(leftHanded = false) {
    const { context, calls } = recorder()
    const canvas = document.createElement('canvas')
    canvas.width = 640
    canvas.height = 480
    canvas.getContext = (() => context) as unknown as HTMLCanvasElement['getContext']
    const video = document.createElement('video')
    Object.defineProperty(video, 'videoWidth', { value: 640 })
    Object.defineProperty(video, 'videoHeight', { value: 480 })
    const placement = leftHanded ? { ...DEFAULT_PLACEMENT, leftHanded: true } : DEFAULT_PLACEMENT
    const view: BoardView = {
        placement,
        fingers: new FingerTracker().debug(),
    }
    return { canvas, video, view, calls }
}

describe('drawBoardOverlay', () => {
    it('desenha seis casas, seis cordas e a zona ampla sem números de acorde alvo', () => {
        const { canvas, video, view, calls } = setup()
        drawBoardOverlay(canvas, video, view)
        expect(calls.filter((call) => call.name === 'stroke')).toHaveLength(12)
        expect(calls.filter((call) => call.name === 'fillText')).toHaveLength(0)
        expect(calls.filter((call) => call.name === 'strokeRect')).toHaveLength(1)
    })

    it('o padrão é mais estreito que um quarto da altura da câmera', () => {
        expect(DEFAULT_PLACEMENT.height).toBeLessThan(0.25)
        expect(DEFAULT_PLACEMENT.width).toBeGreaterThan(0.5)
    })

    it('canhoto desenha a pestana do outro lado', () => {
        const nutX = (leftHanded: boolean) => {
            const { canvas, video, view, calls } = setup(leftHanded)
            drawBoardOverlay(canvas, video, view)
            const firstMove = calls.find((call, index) => call.name === 'moveTo' && index > 6)
            return Number(firstMove?.args[0])
        }
        expect(nutX(true)).not.toBeCloseTo(nutX(false), 0)
    })

    it('não faz nada sem contexto 2D ou com o canvas vazio', () => {
        const { canvas, video, view } = setup()
        vi.spyOn(canvas, 'getContext').mockReturnValue(null)
        expect(() => {
            drawBoardOverlay(canvas, video, view)
        }).not.toThrow()
        const empty = setup()
        empty.canvas.width = 0
        expect(() => {
            drawBoardOverlay(empty.canvas, empty.video, empty.view)
        }).not.toThrow()
        expect(empty.calls).toHaveLength(0)
    })
})
