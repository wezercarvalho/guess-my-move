import { describe, expect, it } from 'vitest'

import { type Point, createPinchDetector, pinchRatio } from '../src/pinch.js'

const THUMB_TIP = 4
const INDEX_TIP = 8
const WRIST = 0
const MIDDLE_MCP = 9

/** Mão com 21 pontos; escala (pulso até a base do médio) de 0,2 na vertical. */
function hand(opts: { tipGap?: number; tipX?: number; tipY?: number; scale?: number } = {}) {
    const { tipGap = 0.07, tipX = 0.5, tipY = 0.5, scale = 0.2 } = opts
    const points: Point[] = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5 }))
    points[WRIST] = { x: 0.5, y: 0.8 }
    points[MIDDLE_MCP] = { x: 0.5, y: 0.8 - scale }
    points[THUMB_TIP] = { x: tipX - tipGap / 2, y: tipY }
    points[INDEX_TIP] = { x: tipX + tipGap / 2, y: tipY }
    return points
}

describe('pinchRatio', () => {
    it('divide a distância entre as pontas pela escala da mão', () => {
        expect(pinchRatio(hand({ tipGap: 0.07 }), 1)).toBeCloseTo(0.35, 9)
        expect(pinchRatio(hand({ tipGap: 0.2 }), 1)).toBeCloseTo(1, 9)
    })

    it('não depende da distância da mão à câmera (invariante à escala)', () => {
        const near = pinchRatio(hand({ tipGap: 0.14, scale: 0.4 }), 1)
        const far = pinchRatio(hand({ tipGap: 0.07, scale: 0.2 }), 1)
        expect(near).toBeCloseTo(far as number, 9)
    })

    it('corrige a proporção da imagem no deslocamento horizontal', () => {
        // Distância entre pontas só no eixo x: com proporção 2, vale o dobro (0,14 / 0,2).
        expect(pinchRatio(hand({ tipGap: 0.07 }), 2)).toBeCloseTo(0.7, 9)
        expect(pinchRatio(hand({ tipGap: 0.07 }), 1)).toBeCloseTo(0.35, 9)
    })

    it('devolve null sem os 21 pontos, com escala degenerada ou proporção inválida', () => {
        expect(pinchRatio(hand().slice(0, 20), 1)).toBeNull()
        expect(pinchRatio(hand({ scale: 0 }), 1)).toBeNull()
        expect(pinchRatio(hand(), 0)).toBeNull()
        expect(pinchRatio(hand(), Number.NaN)).toBeNull()
        expect(pinchRatio(hand(), -1)).toBeNull()
    })
})

describe('createPinchDetector', () => {
    const ratioHand = (ratio: number) => hand({ tipGap: ratio * 0.2 })

    it('fecha com razão <= 0,35 e abre com razão >= 0,55 (histerese)', () => {
        const detector = createPinchDetector()
        expect(detector.update(ratioHand(0.4), 1).closed).toBe(false)
        expect(detector.update(ratioHand(0.3), 1).closed).toBe(true)
        expect(detector.update(ratioHand(0.45), 1).closed).toBe(true)
        expect(detector.update(ratioHand(0.54), 1).closed).toBe(true)
        expect(detector.update(ratioHand(0.6), 1).closed).toBe(false)
        expect(detector.update(ratioHand(0.45), 1).closed).toBe(false)
        expect(detector.update(ratioHand(0.34), 1).closed).toBe(true)
    })

    it('o ponto da pinça é o ponto médio das pontas, espelhado em x', () => {
        const detector = createPinchDetector()
        const reading = detector.update(hand({ tipGap: 0.05, tipX: 0.3, tipY: 0.4 }), 1)
        expect(reading.point?.x).toBeCloseTo(0.7, 9)
        expect(reading.point?.y).toBeCloseTo(0.4, 9)
        expect(reading.handVisible).toBe(true)
    })

    it('informa a razão medida em cada leitura', () => {
        const detector = createPinchDetector()
        expect(detector.update(ratioHand(0.5), 1).ratio).toBeCloseTo(0.5, 9)
    })

    it('sem mão, devolve mão invisível, pinça aberta e sem ponto, e zera a histerese', () => {
        const detector = createPinchDetector()
        detector.update(ratioHand(0.3), 1)
        const lost = detector.update(null, 1)
        expect(lost).toEqual({ handVisible: false, closed: false, ratio: null, point: null })
        expect(detector.update(ratioHand(0.45), 1).closed).toBe(false)
    })

    it('trata pontos inválidos como mão ausente', () => {
        const detector = createPinchDetector()
        expect(detector.update(hand().slice(0, 5), 1).handVisible).toBe(false)
    })

    it('aceita limiares próprios', () => {
        const detector = createPinchDetector({ closeRatio: 0.2, openRatio: 0.3 })
        expect(detector.update(ratioHand(0.25), 1).closed).toBe(false)
        expect(detector.update(ratioHand(0.15), 1).closed).toBe(true)
        expect(detector.update(ratioHand(0.25), 1).closed).toBe(true)
        expect(detector.update(ratioHand(0.31), 1).closed).toBe(false)
    })

    it('reset volta ao estado aberto', () => {
        const detector = createPinchDetector()
        detector.update(ratioHand(0.3), 1)
        detector.reset()
        expect(detector.update(ratioHand(0.45), 1).closed).toBe(false)
    })
})
