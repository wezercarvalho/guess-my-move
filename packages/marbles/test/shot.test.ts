import { describe, expect, it } from 'vitest'

import { DEFAULT_SHOT, computeShot } from '../src/shot.js'

const marble = { x: 150, y: 300 }

describe('computeShot', () => {
    it('atira da pinça para a bolinha: arrastar para a esquerda lança para a direita', () => {
        const shot = computeShot(marble, { x: 50, y: 300 })
        expect(shot).not.toBeNull()
        expect(shot?.velocity.x).toBeCloseTo(500, 6)
        expect(shot?.velocity.y).toBeCloseTo(0, 9)
    })

    it('a velocidade é o ganho (5) vezes a distância do arrasto', () => {
        const shot = computeShot(marble, { x: 150, y: 200 })
        expect(shot?.velocity.x).toBeCloseTo(0, 9)
        expect(shot?.velocity.y).toBeCloseTo(500, 6)
        expect(DEFAULT_SHOT.gain).toBe(5)
    })

    it('na diagonal mantém a direção do arrasto', () => {
        const shot = computeShot(marble, { x: 90, y: 240 })
        const speed = Math.hypot(shot?.velocity.x ?? 0, shot?.velocity.y ?? 0)
        expect(speed).toBeCloseTo(5 * Math.hypot(60, 60), 6)
        expect(shot?.velocity.x).toBeCloseTo(shot?.velocity.y ?? Number.NaN, 6)
        expect(shot?.velocity.x).toBeGreaterThan(0)
    })

    it('limita o arrasto a 220 unidades (velocidade máxima 1100)', () => {
        const shot = computeShot(marble, { x: -400, y: 300 })
        expect(shot?.velocity.x).toBeCloseTo(1100, 6)
        expect(shot?.pull).toBe(220)
        expect(shot?.power).toBe(1)
    })

    it('informa a força relativa entre 0 e 1', () => {
        const shot = computeShot(marble, { x: 40, y: 300 })
        expect(shot?.pull).toBeCloseTo(110, 9)
        expect(shot?.power).toBeCloseTo(0.5, 9)
    })

    it('cancela o tiro quando o arrasto é menor que 30 unidades', () => {
        expect(computeShot(marble, { x: 125, y: 300 })).toBeNull()
        expect(computeShot(marble, marble)).toBeNull()
    })

    it('aceita o arrasto exato de 30 unidades', () => {
        expect(computeShot(marble, { x: 120, y: 300 })).not.toBeNull()
    })

    it('aceita parâmetros próprios', () => {
        const shot = computeShot(marble, { x: 100, y: 300 }, { gain: 10, maxPull: 100, minPull: 10 })
        expect(shot?.velocity.x).toBeCloseTo(500, 6)
    })
})
