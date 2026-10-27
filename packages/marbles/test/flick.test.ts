import { describe, expect, it } from 'vitest'

import * as flickModule from '../src/flick.js'
import { DEFAULT_FLICK, createFlickDetector } from '../src/flick.js'
import { type Point } from '../src/pinch.js'

const WRIST = 0
const THUMB_TIP = 4
const INDEX_TIP = 8
const MIDDLE_MCP = 9

/** Mão com 21 pontos: escala (pulso até a base do médio) de 0,2 e a razão da pinça pedida. */
function hand(opts: { ratio?: number } = {}): Point[] {
    const { ratio = 0.8 } = opts
    const scale = 0.2
    const points: Point[] = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5 }))
    points[WRIST] = { x: 0.5, y: 0.8 }
    points[MIDDLE_MCP] = { x: 0.5, y: 0.8 - scale }
    const gap = ratio * scale
    points[THUMB_TIP] = { x: 0.5 - gap / 2, y: 0.5 }
    points[INDEX_TIP] = { x: 0.5 + gap / 2, y: 0.5 }
    return points
}

describe('o detector de estalo não decide direção nem força', () => {
    it('não exporta mais a orientação da mão nem a conversão em tiro', () => {
        expect(flickModule).not.toHaveProperty('handDirection')
        expect(flickModule).not.toHaveProperty('flickShot')
    })

    it('a configuração só guarda o gatilho: sem velocidade máxima de abertura nem velocidades de tiro', () => {
        expect(DEFAULT_FLICK).not.toHaveProperty('maxOpenSpeed')
        expect(DEFAULT_FLICK).not.toHaveProperty('minShotSpeed')
        expect(DEFAULT_FLICK).not.toHaveProperty('maxShotSpeed')
        expect(DEFAULT_FLICK.slowMs).toBe(80)
        expect(DEFAULT_FLICK.minOpenSpeed).toBe(2)
    })

    it('a leitura e a soltura não têm campo de direção', () => {
        const detector = createFlickDetector()
        const armed = detector.update(hand({ ratio: 0.3 }), 1, 0)
        expect(armed).not.toHaveProperty('direction')
        const released = detector.update(hand({ ratio: 0.9 }), 1, 16)
        expect(released.release).not.toBeNull()
        expect(released.release).not.toHaveProperty('direction')
    })
})

describe('createFlickDetector: armar', () => {
    it('arma ao fechar a pinça (razão <= 0,35)', () => {
        const detector = createFlickDetector()
        const reading = detector.update(hand({ ratio: 0.3 }), 1, 0)
        expect(reading.closed).toBe(true)
        expect(reading.handVisible).toBe(true)
        expect(reading.release).toBeNull()
    })

    it('mantém o ponto médio espelhado e a razão, como o detector de pinça', () => {
        const detector = createFlickDetector()
        const reading = detector.update(hand({ ratio: 0.5 }), 1, 0)
        expect(reading.ratio).toBeCloseTo(0.5, 9)
        expect(reading.point?.x).toBeCloseTo(0.5, 9)
    })

    it('aberta, nunca dispara', () => {
        const detector = createFlickDetector()
        detector.update(hand({ ratio: 0.8 }), 1, 0)
        const reading = detector.update(hand({ ratio: 1.2 }), 1, 16)
        expect(reading.closed).toBe(false)
        expect(reading.release).toBeNull()
    })
})

describe('createFlickDetector: soltura', () => {
    /** Alimenta o detector com `[razão, instante]` e devolve a última leitura. */
    function feed(steps: [number, number][]) {
        const detector = createFlickDetector()
        let last = detector.update(null, 1, 0)
        for (const [ratio, t] of steps) {
            last = detector.update(hand({ ratio }), 1, t)
        }
        return { last, detector }
    }

    it('estalo rápido: mede a duração, a velocidade de pico e marca como rápido', () => {
        const { last } = feed([
            [0.3, 0],
            [0.3, 16],
            [0.3, 32],
            [0.45, 48],
            [0.9, 64],
        ])
        expect(last.release).not.toBeNull()
        expect(last.release?.fast).toBe(true)
        expect(last.release?.riseMs).toBeCloseTo(32, 6)
        expect(last.release?.openSpeed).toBeCloseTo(0.45 / 0.016, 3)
        expect(last.closed).toBe(false)
    })

    it('a velocidade de abertura é o pico entre amostras consecutivas da subida', () => {
        const { last } = feed([
            [0.3, 0],
            [0.38, 16],
            [0.5, 32],
            [0.56, 48],
        ])
        // Inclinações: 0,12/0,016 = 7,5 (de 0,38 a 0,5) e 0,06/0,016 = 3,75; o pico é 7,5.
        expect(last.release?.openSpeed).toBeCloseTo(7.5, 3)
    })

    it('uma abertura em um único quadro conta como rápida', () => {
        const { last } = feed([
            [0.3, 0],
            [0.3, 16],
            [0.9, 32],
        ])
        expect(last.release?.fast).toBe(true)
        expect(last.release?.openSpeed).toBeCloseTo(0.6 / 0.016, 3)
    })

    it('uma subida de 37 ms, como a mais longa dos estalos reais medidos, ainda é rápida', () => {
        const { last } = feed([
            [0.3, 0],
            [0.3, 12],
            [0.5, 24],
            [0.9, 49],
        ])
        expect(last.release?.riseMs).toBeCloseTo(37, 6)
        expect(last.release?.fast).toBe(true)
    })

    it('abertura de 103 ms, como a vista no teste real, não é mais rápida', () => {
        const { last } = feed([
            [0.3, 0],
            [0.45, 30],
            [0.5, 60],
            [0.9, 103],
        ])
        expect(last.release?.riseMs).toBeCloseTo(103, 6)
        expect(last.release?.openSpeed).toBeGreaterThan(DEFAULT_FLICK.minOpenSpeed)
        expect(last.release?.fast).toBe(false)
    })

    it('o limite é inclusivo em 80 ms e deixa de valer logo acima', () => {
        const atLimit = feed([
            [0.3, 0],
            [0.9, 80],
        ])
        expect(atLimit.last.release?.riseMs).toBeCloseTo(80, 6)
        expect(atLimit.last.release?.fast).toBe(true)
        const above = feed([
            [0.3, 0],
            [0.9, 81],
        ])
        expect(above.last.release?.fast).toBe(false)
    })

    it('abertura lenta de verdade (centenas de ms) não é rápida, mesmo com um pico veloz no fim', () => {
        const { last } = feed([
            [0.3, 0],
            [0.39, 10],
            [0.44, 200],
            [0.5, 330],
            [0.9, 346],
        ])
        expect(last.release?.riseMs).toBeCloseTo(336, 6)
        expect(last.release?.openSpeed).toBeGreaterThan(DEFAULT_FLICK.minOpenSpeed)
        expect(last.release?.fast).toBe(false)
    })

    it('abertura fraca (velocidade abaixo de 2 razão/s) não é rápida', () => {
        const detector = createFlickDetector({ slowMs: 1000 })
        detector.update(hand({ ratio: 0.3 }), 1, 0)
        let last = detector.update(hand({ ratio: 0.32 }), 1, 16)
        for (let i = 2; i <= 13; i++) {
            last = detector.update(hand({ ratio: 0.3 + i * 0.02 }), 1, i * 16)
        }
        expect(last.release).not.toBeNull()
        expect(last.release?.openSpeed).toBeCloseTo(1.25, 2)
        expect(last.release?.fast).toBe(false)
    })

    it('depois da soltura, o detector volta a desarmado e só dispara de novo ao rearmar', () => {
        const { detector } = feed([
            [0.3, 0],
            [0.3, 16],
            [0.9, 32],
        ])
        const open = detector.update(hand({ ratio: 1.0 }), 1, 48)
        expect(open.closed).toBe(false)
        expect(open.release).toBeNull()
        detector.update(hand({ ratio: 0.3 }), 1, 64)
        const again = detector.update(hand({ ratio: 0.9 }), 1, 80)
        expect(again.release).not.toBeNull()
    })

    it('perder a mão zera o armado: reaparecer aberta não dispara', () => {
        const detector = createFlickDetector()
        detector.update(hand({ ratio: 0.3 }), 1, 0)
        const lost = detector.update(null, 1, 16)
        expect(lost).toMatchObject({ handVisible: false, closed: false, release: null })
        const back = detector.update(hand({ ratio: 0.9 }), 1, 32)
        expect(back.release).toBeNull()
    })

    it('reset volta ao estado inicial', () => {
        const detector = createFlickDetector()
        detector.update(hand({ ratio: 0.3 }), 1, 0)
        detector.reset()
        expect(detector.update(hand({ ratio: 0.9 }), 1, 16).release).toBeNull()
    })
})
