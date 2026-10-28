import { describe, expect, it, vi } from 'vitest'

import { LINE_COUNT, MIN_INTENSITY, drawSpeedLines } from './speedLines.js'

function fakeContext() {
    return {
        clearRect: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        strokeStyle: '',
        lineWidth: 0,
    }
}

const asContext = (fake: ReturnType<typeof fakeContext>) => fake as unknown as CanvasRenderingContext2D

describe('drawSpeedLines', () => {
    it('só limpa o quadro quando a velocidade é baixa', () => {
        const fake = fakeContext()
        drawSpeedLines(asContext(fake), 800, 450, MIN_INTENSITY / 2, 0)
        expect(fake.clearRect).toHaveBeenCalledWith(0, 0, 800, 450)
        expect(fake.stroke).not.toHaveBeenCalled()
    })

    it('desenha uma linha por raio em velocidade alta', () => {
        const fake = fakeContext()
        drawSpeedLines(asContext(fake), 800, 450, 1, 0)
        expect(fake.stroke).toHaveBeenCalledTimes(LINE_COUNT)
    })

    it('as linhas ficam longe do centro, para não cobrir o que está à frente', () => {
        const fake = fakeContext()
        drawSpeedLines(asContext(fake), 800, 450, 1, 0.3)
        for (const [x, y] of fake.moveTo.mock.calls as [number, number][]) {
            expect(Math.hypot(x - 400, y - 225)).toBeGreaterThan(0.25 * Math.hypot(400, 225))
        }
    })

    it('a opacidade cresce com a velocidade', () => {
        const slow = fakeContext()
        const fast = fakeContext()
        drawSpeedLines(asContext(slow), 800, 450, 0.4, 0)
        drawSpeedLines(asContext(fast), 800, 450, 1, 0)
        const alpha = (value: string) => Number(/,\s*([\d.]+)\)$/.exec(value)?.[1])
        expect(alpha(fast.strokeStyle)).toBeGreaterThan(alpha(slow.strokeStyle))
    })
})
