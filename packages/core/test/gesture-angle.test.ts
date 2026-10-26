import { describe, expect, it } from 'vitest'

import { handAngleDeg } from '../src/index.js'

/** 21 pontos na origem, com o pulso (0) e o início do dedo médio (9) definidos. */
function hand(wrist: [number, number], middleMcp: [number, number]) {
    const points = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5 }))
    points[0] = { x: wrist[0], y: wrist[1] }
    points[9] = { x: middleMcp[0], y: middleMcp[1] }
    return points
}

describe('handAngleDeg', () => {
    it('devolve 0 quando a mão aponta para cima', () => {
        expect(handAngleDeg(hand([0.5, 0.8], [0.5, 0.5]), 1)).toBeCloseTo(0, 6)
    })

    it('devolve valor positivo quando a mão se inclina para a direita da imagem', () => {
        expect(handAngleDeg(hand([0.5, 0.8], [0.8, 0.5]), 1)).toBeCloseTo(45, 6)
    })

    it('devolve valor negativo quando a mão se inclina para a esquerda', () => {
        expect(handAngleDeg(hand([0.5, 0.8], [0.2, 0.5]), 1)).toBeCloseTo(-45, 6)
    })

    it('devolve 90 e -90 com a mão na horizontal', () => {
        expect(handAngleDeg(hand([0.2, 0.5], [0.5, 0.5]), 1)).toBeCloseTo(90, 6)
        expect(handAngleDeg(hand([0.8, 0.5], [0.5, 0.5]), 1)).toBeCloseTo(-90, 6)
    })

    it('devolve ±180 quando a mão aponta para baixo', () => {
        const angle = handAngleDeg(hand([0.5, 0.2], [0.5, 0.5]), 1)
        expect(Math.abs(angle ?? 0)).toBeCloseTo(180, 6)
    })

    it('corrige o deslocamento horizontal pela proporção largura/altura', () => {
        // dx normalizado 0,15 em uma imagem 16:9 vale 0,15 * 16/9 em unidades de altura.
        const aspect = 16 / 9
        const angle = handAngleDeg(hand([0.5, 0.8], [0.65, 0.5]), aspect)
        expect(angle).toBeCloseTo((Math.atan2(0.15 * aspect, 0.3) * 180) / Math.PI, 6)
        expect(angle).not.toBeCloseTo(handAngleDeg(hand([0.5, 0.8], [0.65, 0.5]), 1) ?? 0, 1)
    })

    it('devolve null quando o vetor é degenerado', () => {
        expect(handAngleDeg(hand([0.5, 0.5], [0.5, 0.5]), 1)).toBeNull()
    })

    it('devolve null quando faltam pontos ou a proporção é inválida', () => {
        expect(handAngleDeg([], 1)).toBeNull()
        expect(handAngleDeg(hand([0.5, 0.8], [0.5, 0.5]).slice(0, 9), 1)).toBeNull()
        expect(handAngleDeg(hand([0.5, 0.8], [0.8, 0.5]), 0)).toBeNull()
        expect(handAngleDeg(hand([0.5, 0.8], [0.8, 0.5]), Number.NaN)).toBeNull()
    })
})
