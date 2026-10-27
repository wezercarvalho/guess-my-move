import { type BeteSnapshot } from '@guess-my-move/marbles'
import { describe, expect, it, vi } from 'vitest'

import { drawField } from './fieldView.js'

/** Contexto 2D falso que só registra as chamadas de desenho. */
function stubCanvas() {
    const calls: string[] = []
    const record = (name: string) =>
        vi.fn(() => {
            calls.push(name)
        })
    const gradient = { addColorStop: vi.fn() }
    const context = {
        clearRect: record('clearRect'),
        fillRect: record('fillRect'),
        strokeRect: record('strokeRect'),
        beginPath: record('beginPath'),
        arc: record('arc'),
        fill: record('fill'),
        stroke: record('stroke'),
        moveTo: record('moveTo'),
        lineTo: record('lineTo'),
        closePath: record('closePath'),
        setLineDash: record('setLineDash'),
        createRadialGradient: vi.fn(() => gradient),
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 0,
        lineCap: '',
    }
    const canvas = { getContext: vi.fn(() => context), width: 800, height: 600 }
    return { canvas: canvas as unknown as HTMLCanvasElement, context, calls }
}

const base: BeteSnapshot = {
    state: 'ready',
    shooter: { x: 150, y: 300 },
    target: { x: 550, y: 300 },
    shots: 0,
    aim: null,
    flick: null,
    hitShots: null,
    failureReason: null,
}

describe('drawField', () => {
    it('não faz nada quando o canvas não tem contexto 2D', () => {
        const canvas = { getContext: () => null } as unknown as HTMLCanvasElement
        expect(() => {
            drawField(canvas, base)
        }).not.toThrow()
    })

    it('limpa e pinta o terreno', () => {
        const { canvas, calls } = stubCanvas()
        drawField(canvas, base)
        expect(calls[0]).toBe('clearRect')
        expect(calls).toContain('fillRect')
    })

    it('desenha a bolinha de tiro e o alvo nas posições da foto', () => {
        const { canvas, context } = stubCanvas()
        drawField(canvas, base)
        const centers = (context.arc.mock.calls as unknown as number[][]).map(([x, y, r]) => [
            x,
            y,
            r,
        ])
        expect(centers).toContainEqual([150, 300, 14])
        expect(centers).toContainEqual([550, 300, 14])
    })

    it('sem mira, não desenha elástico nem seta', () => {
        const { canvas, context } = stubCanvas()
        drawField(canvas, base)
        expect(context.lineTo).not.toHaveBeenCalled()
    })

    it('durante a mira, desenha o elástico, o cursor da pinça e a seta de previsão', () => {
        const { canvas, context } = stubCanvas()
        const aiming: BeteSnapshot = {
            ...base,
            state: 'aiming',
            aim: {
                pinch: { x: 50, y: 300 },
                shot: { velocity: { x: 500, y: 0 }, pull: 100, power: 0.45 },
            },
        }
        drawField(canvas, aiming)
        const arcs = (context.arc.mock.calls as unknown as number[][]).map(([x, y]) => [x, y])
        expect(arcs).toContainEqual([50, 300])
        expect(context.lineTo).toHaveBeenCalled()
        expect((context.lineTo.mock.calls as unknown as number[][]).length).toBeGreaterThanOrEqual(2)
    })

    it('desenha o cursor da mão na posição da pinça, mesmo sem mira', () => {
        const { canvas, context } = stubCanvas()
        drawField(canvas, base, { point: { x: 320, y: 210 }, closed: false })
        const arcs = (context.arc.mock.calls as unknown as number[][]).map(([x, y]) => [x, y])
        expect(arcs).toContainEqual([320, 210])
    })

    it('sem mão visível, não desenha cursor', () => {
        const withHand = stubCanvas()
        const without = stubCanvas()
        drawField(withHand.canvas, base, { point: { x: 320, y: 210 }, closed: false })
        drawField(without.canvas, base, null)
        expect(without.context.arc.mock.calls.length).toBeLessThan(
            withHand.context.arc.mock.calls.length,
        )
    })

    it('a pinça fechada é preenchida e a aberta é só um anel', () => {
        const opened = stubCanvas()
        const closedHand = stubCanvas()
        drawField(opened.canvas, base, { point: { x: 320, y: 210 }, closed: false })
        drawField(closedHand.canvas, base, { point: { x: 320, y: 210 }, closed: true })
        expect(closedHand.context.fill.mock.calls.length).toBe(
            opened.context.fill.mock.calls.length + 1,
        )
    })

    it('no modo estalo armado, desenha a seta de direção da mão, sem elástico da pinça', () => {
        const { canvas, context } = stubCanvas()
        drawField(canvas, {
            ...base,
            state: 'aiming',
            flick: { direction: { x: 0, y: -1 } },
        })
        const lines = context.lineTo.mock.calls as unknown as number[][]
        // Haste e as duas pontas da seta.
        expect(lines.length).toBe(3)
        // A seta sai da bolinha de tiro e sobe (y diminui).
        const tip = lines[1]
        expect(tip[0]).toBeCloseTo(150, 6)
        expect(tip[1]).toBeLessThan(300)
    })

        it('com arrasto curto, mostra o elástico mas não a seta de previsão', () => {
        const withShot = stubCanvas()
        const withoutShot = stubCanvas()
        const pinch = { x: 130, y: 300 }
        drawField(withShot.canvas, {
            ...base,
            state: 'aiming',
            aim: { pinch, shot: { velocity: { x: 100, y: 0 }, pull: 20, power: 0.1 } },
        })
        drawField(withoutShot.canvas, { ...base, state: 'aiming', aim: { pinch, shot: null } })
        expect(withoutShot.context.lineTo.mock.calls.length).toBeLessThan(
            withShot.context.lineTo.mock.calls.length,
        )
    })
})
