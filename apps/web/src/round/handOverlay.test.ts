import { type HandLandmark } from '@guess-my-move/core'
import { describe, expect, it, vi } from 'vitest'

import { containRect, drawHand } from './handOverlay.js'

function fakeContext() {
    return {
        clearRect: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        lineWidth: 0,
        strokeStyle: '',
        fillStyle: '',
    }
}

function fakeCanvas(context: ReturnType<typeof fakeContext> | null) {
    return {
        width: 0,
        height: 0,
        getContext: vi.fn(() => context),
    } as unknown as HTMLCanvasElement
}

function fakeVideo(width = 640, height = 480, clientWidth = 320, clientHeight = 240) {
    return {
        videoWidth: width,
        videoHeight: height,
        clientWidth,
        clientHeight,
    } as unknown as HTMLVideoElement
}

const hand: HandLandmark[] = Array.from({ length: 21 }, (_, i) => ({
    x: i / 21,
    y: 0.5,
}))

describe('containRect', () => {
    it('centraliza o vídeo mais largo que a caixa', () => {
        expect(containRect(400, 200, 100, 100)).toEqual({
            x: 100,
            y: 0,
            width: 200,
            height: 200,
        })
    })

    it('centraliza o vídeo mais alto que a caixa', () => {
        expect(containRect(200, 400, 100, 100)).toEqual({
            x: 0,
            y: 100,
            width: 200,
            height: 200,
        })
    })

    it('devolve a caixa inteira quando não há dimensões do vídeo', () => {
        expect(containRect(300, 150, 0, 0)).toEqual({ x: 0, y: 0, width: 300, height: 150 })
    })
})

describe('drawHand', () => {
    it('desenha os 21 pontos e as 21 conexões da mão', () => {
        const context = fakeContext()
        const canvas = fakeCanvas(context)
        drawHand(canvas, fakeVideo(), hand)
        expect(context.clearRect).toHaveBeenCalledTimes(1)
        expect(context.arc).toHaveBeenCalledTimes(21)
        expect(context.lineTo).toHaveBeenCalledTimes(21)
    })

    it('ajusta o canvas ao tamanho exibido do vídeo', () => {
        const canvas = fakeCanvas(fakeContext())
        drawHand(canvas, fakeVideo(640, 480, 320, 240), hand)
        expect(canvas.width).toBe(320)
        expect(canvas.height).toBe(240)
    })

    it('mapeia as coordenadas normalizadas para a área do vídeo', () => {
        const context = fakeContext()
        const canvas = fakeCanvas(context)
        // Vídeo 4:3 numa caixa 400x200: ocupa 266,7x200, centralizado em x.
        drawHand(canvas, fakeVideo(640, 480, 400, 200), [{ x: 0, y: 0 }, { x: 1, y: 1 }])
        const [firstX, firstY] = context.arc.mock.calls[0] as [number, number]
        const [lastX, lastY] = context.arc.mock.calls[1] as [number, number]
        expect(firstX).toBeCloseTo((400 - (200 * 4) / 3) / 2, 5)
        expect(firstY).toBeCloseTo(0, 5)
        expect(lastX).toBeCloseTo(400 - (400 - (200 * 4) / 3) / 2, 5)
        expect(lastY).toBeCloseTo(200, 5)
    })

    it('só limpa o canvas quando não há mão', () => {
        const context = fakeContext()
        drawHand(fakeCanvas(context), fakeVideo(), null)
        expect(context.clearRect).toHaveBeenCalledTimes(1)
        expect(context.arc).not.toHaveBeenCalled()
    })

    it('não falha quando o canvas não tem contexto 2D', () => {
        expect(() => {
            drawHand(fakeCanvas(null), fakeVideo(), hand)
        }).not.toThrow()
    })
})
