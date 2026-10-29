import { type Body, type FieldDecor } from '@guess-my-move/marbles'
import { describe, expect, it, vi } from 'vitest'

import { type FieldDraw, drawField } from './fieldView.js'

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

const body = (x: number, y: number, radius = 14): Body => ({
    pos: { x, y },
    vel: { x: 0, y: 0 },
    radius,
})

const base: FieldDraw = {
    field: [body(150, 300), body(550, 300)],
    decor: null,
    aim: null,
    hand: null,
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

    it('desenha a bolinha de tiro e as demais nas posições do campo', () => {
        const { canvas, context } = stubCanvas()
        drawField(canvas, base)
        const centers = (context.arc.mock.calls as unknown as number[][]).map(([x, y, r]) => [x, y, r])
        expect(centers).toContainEqual([150, 300, 14])
        expect(centers).toContainEqual([550, 300, 14])
    })

    it('sem mira, não desenha elástico nem seta', () => {
        const { canvas, context } = stubCanvas()
        drawField(canvas, base)
        expect(context.lineTo).not.toHaveBeenCalled()
    })

    it('durante a mira da pinça, desenha o elástico, o cursor da pinça e a seta de previsão', () => {
        const { canvas, context } = stubCanvas()
        drawField(canvas, {
            ...base,
            aim: {
                pinch: { x: 50, y: 300 },
                shot: { velocity: { x: 500, y: 0 }, power: 0.45 },
                direction: null,
            },
        })
        const arcs = (context.arc.mock.calls as unknown as number[][]).map(([x, y]) => [x, y])
        expect(arcs).toContainEqual([50, 300])
        expect(context.lineTo).toHaveBeenCalled()
        expect((context.lineTo.mock.calls as unknown as number[][]).length).toBeGreaterThanOrEqual(2)
    })

    it('desenha o cursor da mão na posição da pinça, mesmo sem mira', () => {
        const { canvas, context } = stubCanvas()
        drawField(canvas, { ...base, hand: { point: { x: 320, y: 210 }, closed: false } })
        const arcs = (context.arc.mock.calls as unknown as number[][]).map(([x, y]) => [x, y])
        expect(arcs).toContainEqual([320, 210])
    })

    it('a pinça fechada é preenchida e a aberta é só um anel', () => {
        const opened = stubCanvas()
        const closedHand = stubCanvas()
        drawField(opened.canvas, { ...base, hand: { point: { x: 320, y: 210 }, closed: false } })
        drawField(closedHand.canvas, { ...base, hand: { point: { x: 320, y: 210 }, closed: true } })
        expect(closedHand.context.fill.mock.calls.length).toBe(
            opened.context.fill.mock.calls.length + 1,
        )
    })

    it('no estalo armado, desenha a seta de direção da mão, sem elástico da pinça', () => {
        const { canvas, context } = stubCanvas()
        drawField(canvas, {
            ...base,
            aim: { pinch: { x: 150, y: 300 }, shot: null, direction: { x: 0, y: -1 } },
        })
        const lines = context.lineTo.mock.calls as unknown as number[][]
        // Haste e as duas pontas da seta.
        expect(lines.length).toBe(3)
        const tip = lines[1]
        expect(tip[0]).toBeCloseTo(150, 6)
        expect(tip[1]).toBeLessThan(300)
    })

    it('desenha o círculo do modo Triângulo quando há decoração de círculo', () => {
        const { canvas, context } = stubCanvas()
        const decor: FieldDecor = { circle: { x: 560, y: 300, radius: 120 } }
        drawField(canvas, { ...base, field: [body(90, 300)], decor })
        const arcs = (context.arc.mock.calls as unknown as number[][]).map(([x, y, r]) => [x, y, r])
        expect(arcs).toContainEqual([560, 300, 120])
    })

    it('desenha as três covas do modo Cova e destaca a ativa com traço mais grosso', () => {
        const { canvas, context } = stubCanvas()
        const decor: FieldDecor = {
            holes: {
                positions: [
                    { x: 300, y: 300 },
                    { x: 520, y: 180 },
                    { x: 680, y: 420 },
                ],
                radius: 22,
                active: 1,
            },
        }
        drawField(canvas, { ...base, field: [body(90, 300)], decor })
        const arcs = (context.arc.mock.calls as unknown as number[][]).map(([x, y, r]) => [x, y, r])
        expect(arcs).toContainEqual([300, 300, 22])
        expect(arcs).toContainEqual([520, 180, 22])
        expect(arcs).toContainEqual([680, 420, 22])
    })
})
