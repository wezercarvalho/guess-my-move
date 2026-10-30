import {
    DEFAULT_PLACEMENT,
    FingerTracker,
    chordById,
    evaluateChord,
} from '@guess-my-move/guitar'
import { describe, expect, it, vi } from 'vitest'

import { type BoardView, drawBoardOverlay } from './boardOverlay.js'

/** Contexto 2D gravador: guarda as chamadas e os estilos usados. */
function recorder() {
    const calls: { name: string; args: unknown[] }[] = []
    const strokeStyles: unknown[] = []
    const target: Record<string, unknown> = {}
    const context = new Proxy(target, {
        get(_object, name: string) {
            if (name === 'strokeStyle') return strokeStyles[strokeStyles.length - 1]
            return (...args: unknown[]) => {
                calls.push({ name, args })
            }
        },
        set(_object, name: string, value: unknown) {
            if (name === 'strokeStyle') strokeStyles.push(value)
            return true
        },
    })
    return { context: context as unknown as CanvasRenderingContext2D, calls, strokeStyles }
}

function setup(leftHanded = false, presses: Parameters<typeof evaluateChord>[1] = []) {
    const { context, calls, strokeStyles } = recorder()
    const canvas = document.createElement('canvas')
    canvas.width = 640
    canvas.height = 480
    canvas.getContext = (() => context) as unknown as HTMLCanvasElement['getContext']
    const video = document.createElement('video')
    Object.defineProperty(video, 'videoWidth', { value: 640 })
    Object.defineProperty(video, 'videoHeight', { value: 480 })
    const placement = leftHanded ? { ...DEFAULT_PLACEMENT, leftHanded: true } : DEFAULT_PLACEMENT
    const target = chordById('Em')
    const view: BoardView = {
        placement,
        target,
        evaluation: evaluateChord(target, presses),
        fingers: new FingerTracker().debug(),
    }
    return { canvas, video, view, calls, strokeStyles }
}

describe('drawBoardOverlay', () => {
    it('desenha as cordas e as casas e os números dos dedos do alvo, sem espelhar o texto', () => {
        const { canvas, video, view, calls } = setup()
        drawBoardOverlay(canvas, video, view)
        const strokes = calls.filter((call) => call.name === 'stroke').length
        // 6 pestanas/casas + 6 cordas + 4 marcas de corda solta + 2 anéis do alvo + zona
        expect(strokes).toBeGreaterThanOrEqual(6 + 6 + 2)
        const labels = calls.filter((call) => call.name === 'fillText').map((call) => call.args[0])
        expect(labels).toEqual(['2', '3'])
        // o texto é contra-espelhado: o canvas inteiro é espelhado por CSS
        expect(calls.some((call) => call.name === 'scale' && call.args[0] === -1)).toBe(true)
    })

    it('cordas certas e erradas usam cores diferentes', () => {
        const right = setup(false, [
            { finger: 2, string: 5, fret: 2 },
            { finger: 3, string: 4, fret: 2 },
        ])
        drawBoardOverlay(right.canvas, right.video, right.view)
        const wrong = setup(false, [{ finger: 2, string: 3, fret: 2 }])
        drawBoardOverlay(wrong.canvas, wrong.video, wrong.view)
        expect(new Set(right.strokeStyles).has('#ff6b6b')).toBe(false)
        expect(new Set(wrong.strokeStyles).has('#ff6b6b')).toBe(true)
        expect(new Set(wrong.strokeStyles).has('#e0aa08')).toBe(true)
    })

    it('canhoto desenha a pestana do outro lado', () => {
        const nutX = (leftHanded: boolean) => {
            const { canvas, video, view, calls } = setup(leftHanded)
            drawBoardOverlay(canvas, video, view)
            // a pestana é o primeiro traço vertical depois da sombra do braço
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
