import { type FaceLandmark } from '@guess-my-move/swing'
import { describe, expect, it, vi } from 'vitest'

import { FACE_POINT_INDICES, drawFace } from './faceOverlay.js'

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

/** 468 pontos simulados do FaceMesh, no centro, para não depender da topologia real. */
const face: FaceLandmark[] = Array.from({ length: 468 }, () => ({ x: 0.5, y: 0.5 }))

describe('drawFace', () => {
    it('não limpa o canvas (desenha por cima das mãos)', () => {
        const context = fakeContext()
        drawFace(fakeCanvas(context), fakeVideo(), face, { yaw: 0, pitch: 0 })
        expect(context.clearRect).not.toHaveBeenCalled()
    })

    it('desenha os pontos esparsos do rosto', () => {
        const context = fakeContext()
        drawFace(fakeCanvas(context), fakeVideo(), face, { yaw: 0, pitch: 0 })
        expect(context.arc).toHaveBeenCalledTimes(FACE_POINT_INDICES.length)
    })

    it('desenha o eixo do olhar a partir do nariz (uma linha)', () => {
        const context = fakeContext()
        drawFace(fakeCanvas(context), fakeVideo(), face, { yaw: 0.3, pitch: 0 })
        expect(context.lineTo).toHaveBeenCalled()
    })

    it('o eixo aponta para -x do canvas quando olha para a direita (o canvas é espelhado por CSS)', () => {
        const context = fakeContext()
        drawFace(fakeCanvas(context), fakeVideo(), face, { yaw: 0.3, pitch: 0 })
        const from = context.moveTo.mock.calls[0] as [number, number]
        const to = context.lineTo.mock.calls[0] as [number, number]
        expect(to[0]).toBeLessThan(from[0])
        expect(to[1]).toBeCloseTo(from[1])
    })

    it('o eixo sobe na tela quando olha para cima', () => {
        const context = fakeContext()
        drawFace(fakeCanvas(context), fakeVideo(), face, { yaw: 0, pitch: 0.3 })
        const from = context.moveTo.mock.calls[0] as [number, number]
        const to = context.lineTo.mock.calls[0] as [number, number]
        expect(to[1]).toBeLessThan(from[1])
    })

    it('não desenha nada sem pontos', () => {
        const context = fakeContext()
        drawFace(fakeCanvas(context), fakeVideo(), [], { yaw: 0, pitch: 0 })
        expect(context.arc).not.toHaveBeenCalled()
        expect(context.lineTo).not.toHaveBeenCalled()
    })

    it('não guarda nada: duas chamadas iguais produzem o mesmo número de operações', () => {
        const a = fakeContext()
        const b = fakeContext()
        drawFace(fakeCanvas(a), fakeVideo(), face, { yaw: 0.2, pitch: 0.1 })
        drawFace(fakeCanvas(b), fakeVideo(), face, { yaw: 0.2, pitch: 0.1 })
        expect(a.arc.mock.calls.length).toBe(b.arc.mock.calls.length)
        expect(a.lineTo.mock.calls.length).toBe(b.lineTo.mock.calls.length)
    })

    it('não falha quando o canvas não tem contexto 2D', () => {
        expect(() => {
            drawFace(fakeCanvas(null), fakeVideo(), face, { yaw: 0, pitch: 0 })
        }).not.toThrow()
    })
})
