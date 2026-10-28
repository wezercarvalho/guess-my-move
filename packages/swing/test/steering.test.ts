import { describe, expect, it } from 'vitest'

import { steerFromHand } from '../src/steering.js'

/** Mão de 21 pontos, todos em `x, y` (basta para o centro da palma). */
const hand = (x: number, y: number) => Array.from({ length: 21 }, () => ({ x, y }))

describe('steerFromHand', () => {
    it('mão no centro não gira', () => {
        expect(steerFromHand(hand(0.5, 0.5))).toEqual({ yawRate: 0, pitchRate: 0 })
    })

    it('zona morta de 0,10 ao redor do centro', () => {
        const look = steerFromHand(hand(0.45, 0.56))
        expect(look.yawRate).toBe(0)
        expect(look.pitchRate).toBe(0)
    })

    it('espelha x: mão na esquerda da imagem crua (direita do usuário) gira para a direita', () => {
        const look = steerFromHand(hand(0.2, 0.5))
        expect(look.yawRate).toBeCloseTo(0.8)
        expect(steerFromHand(hand(0.8, 0.5)).yawRate).toBeCloseTo(-0.8)
    })

    it('mão alta olha para cima e mão baixa olha para baixo', () => {
        expect(steerFromHand(hand(0.5, 0.2)).pitchRate).toBeCloseTo(0.8)
        expect(steerFromHand(hand(0.5, 0.8)).pitchRate).toBeCloseTo(-0.8)
    })

    it('satura em 1 a partir de 0,35 do centro', () => {
        const look = steerFromHand(hand(0.0, 0.0))
        expect(look.yawRate).toBe(1)
        expect(look.pitchRate).toBe(1)
    })

    it('usa o centro da palma (pulso e bases dos dedos), não a ponta dos dedos', () => {
        const points = hand(0.5, 0.5)
        points[8] = { x: 0.0, y: 0.0 }
        expect(steerFromHand(points)).toEqual({ yawRate: 0, pitchRate: 0 })
    })

    it('sem mão ou com mão incompleta mantém a direção', () => {
        expect(steerFromHand(null)).toEqual({ yawRate: 0, pitchRate: 0 })
        expect(steerFromHand([{ x: 0, y: 0 }])).toEqual({ yawRate: 0, pitchRate: 0 })
    })
})
