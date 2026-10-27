import { describe, expect, it } from 'vitest'

import {
    DEFAULT_FLICK,
    type FlickRelease,
    createFlickDetector,
    flickShot,
    handDirection,
} from '../src/flick.js'
import { type Point } from '../src/pinch.js'

const WRIST = 0
const THUMB_TIP = 4
const INDEX_TIP = 8
const MIDDLE_MCP = 9

/**
 * Mão com 21 pontos: escala (pulso até a base do médio) de 0,2, apontando
 * `angleDeg` graus a partir de "para cima" (positivo = para a direita da imagem).
 */
function hand(opts: { ratio?: number; angleDeg?: number; aspect?: number } = {}): Point[] {
    const { ratio = 0.8, angleDeg = 0, aspect = 1 } = opts
    const scale = 0.2
    const radians = (angleDeg * Math.PI) / 180
    const points: Point[] = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5 }))
    points[WRIST] = { x: 0.5, y: 0.8 }
    points[MIDDLE_MCP] = {
        x: 0.5 + (scale * Math.sin(radians)) / aspect,
        y: 0.8 - scale * Math.cos(radians),
    }
    const gap = (ratio * scale) / aspect
    points[THUMB_TIP] = { x: 0.5 - gap / 2, y: 0.5 }
    points[INDEX_TIP] = { x: 0.5 + gap / 2, y: 0.5 }
    return points
}

describe('handDirection', () => {
    it('mão apontando para cima na imagem lança para cima no campo', () => {
        const direction = handDirection(hand({ angleDeg: 0 }), 1)
        expect(direction?.x).toBeCloseTo(0, 9)
        expect(direction?.y).toBeCloseTo(-1, 9)
    })

    it('é espelhada: apontar para a direita da imagem é a esquerda do campo', () => {
        const direction = handDirection(hand({ angleDeg: 90 }), 1)
        expect(direction?.x).toBeCloseTo(-1, 9)
        expect(direction?.y).toBeCloseTo(0, 9)
    })

    it('apontar para a esquerda da imagem é a direita do campo, e para baixo é para baixo', () => {
        const left = handDirection(hand({ angleDeg: -90 }), 1)
        expect(left?.x).toBeCloseTo(1, 9)
        const down = handDirection(hand({ angleDeg: 180 }), 1)
        expect(down?.y).toBeCloseTo(1, 9)
    })

    it('corrige a proporção da imagem: 45 graus continua sendo 45 graus com proporção 2', () => {
        const direction = handDirection(hand({ angleDeg: 45, aspect: 2 }), 2)
        expect(direction?.x).toBeCloseTo(-Math.SQRT1_2, 6)
        expect(direction?.y).toBeCloseTo(-Math.SQRT1_2, 6)
    })

    it('devolve um vetor unitário', () => {
        const direction = handDirection(hand({ angleDeg: 30 }), 1)
        expect(Math.hypot(direction?.x ?? 0, direction?.y ?? 0)).toBeCloseTo(1, 9)
    })

    it('devolve null sem os 21 pontos, com vetor degenerado ou proporção inválida', () => {
        expect(handDirection(hand().slice(0, 20), 1)).toBeNull()
        const flat = hand()
        flat[MIDDLE_MCP] = { ...(flat[WRIST]) }
        expect(handDirection(flat, 1)).toBeNull()
        expect(handDirection(hand(), 0)).toBeNull()
        expect(handDirection(hand(), Number.NaN)).toBeNull()
    })
})

describe('createFlickDetector: armar', () => {
    it('arma ao fechar a pinça (razão <= 0,35) e expõe a direção da mão', () => {
        const detector = createFlickDetector()
        const reading = detector.update(hand({ ratio: 0.3 }), 1, 0)
        expect(reading.closed).toBe(true)
        expect(reading.handVisible).toBe(true)
        expect(reading.release).toBeNull()
        expect(reading.direction?.y).toBeCloseTo(-1, 9)
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
    /** Alimenta o detector com `[razão, instante, ângulo opcional]` e devolve a última leitura. */
    function feed(steps: [number, number, number?][]) {
        const detector = createFlickDetector()
        let last = detector.update(null, 1, 0)
        for (const [ratio, t, angleDeg = 0] of steps) {
            last = detector.update(hand({ ratio, angleDeg }), 1, t)
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

    it('o limite é inclusivo em 80 ms; 81 ms e os 103 ms vistos no teste real não são rápidos', () => {
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
        const seen = feed([
            [0.3, 0],
            [0.45, 30],
            [0.5, 60],
            [0.9, 103],
        ])
        expect(seen.last.release?.riseMs).toBeCloseTo(103, 6)
        expect(seen.last.release?.fast).toBe(false)
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
        const { last } = feed([
            [0.3, 0],
            [0.32, 16],
            [0.34, 32],
            [0.36, 48],
            [0.38, 64],
            [0.4, 80],
            [0.42, 96],
            [0.44, 112],
            [0.46, 128],
            [0.48, 144],
            [0.5, 160],
            [0.52, 176],
            [0.54, 192],
            [0.56, 208],
        ])
        expect(last.release).not.toBeNull()
        expect(last.release?.openSpeed).toBeCloseTo(1.25, 2)
        expect(last.release?.fast).toBe(false)
    })

    it('a direção do tiro é a medida no início da subida, não a do fim do estalo', () => {
        const { last } = feed([
            [0.3, 0, 0],
            [0.3, 16, 0],
            [0.3, 32, 0],
            [0.45, 48, 90],
            [0.9, 64, 90],
        ])
        // O início da subida (32 ms) ainda aponta para cima; o fim aponta para a direita da imagem.
        expect(last.release?.direction?.y).toBeCloseTo(-1, 9)
        expect(last.release?.direction?.x).toBeCloseTo(0, 9)
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

describe('flickShot: força pelo polegar, em escala logarítmica', () => {
    const release = (overrides: Partial<FlickRelease> = {}): FlickRelease => ({
        fast: true,
        openSpeed: 50,
        riseMs: 12,
        direction: { x: 0, y: -1 },
        ...overrides,
    })

    it('mapeia 10 a 200 razão/s para 300 a 1100 unid/s, em escala logarítmica', () => {
        const low = flickShot(release({ openSpeed: 10 }))
        expect(low?.velocity.y).toBeCloseTo(-300, 6)
        expect(low?.power).toBe(0)
        // A média geométrica de 10 e 200 fica no meio da escala.
        const mid = flickShot(release({ openSpeed: Math.sqrt(10 * 200) }))
        expect(mid?.power).toBeCloseTo(0.5, 9)
        expect(mid?.velocity.y).toBeCloseTo(-700, 6)
        const top = flickShot(release({ openSpeed: 200 }))
        expect(top?.velocity.y).toBeCloseTo(-1100, 6)
        expect(top?.power).toBe(1)
    })

    it('a força cresce com a velocidade e dobrar a velocidade soma sempre o mesmo à força', () => {
        const a = flickShot(release({ openSpeed: 20 }))?.power ?? NaN
        const b = flickShot(release({ openSpeed: 40 }))?.power ?? NaN
        const c = flickShot(release({ openSpeed: 80 }))?.power ?? NaN
        expect(b).toBeGreaterThan(a)
        expect(c).toBeGreaterThan(b)
        expect(b - a).toBeCloseTo(c - b, 9)
    })

    it('limita abaixo e acima da escala sem cancelar o tiro', () => {
        const weak = flickShot(release({ openSpeed: 4 }))
        expect(weak?.power).toBe(0)
        expect(weak?.velocity.y).toBeCloseTo(-300, 6)
        const strong = flickShot(release({ openSpeed: 900 }))
        expect(strong?.power).toBe(1)
        expect(strong?.velocity.y).toBeCloseTo(-1100, 6)
    })

    it('os valores medidos no teste real (9,1 a 199 razão/s) cobrem quase toda a escala', () => {
        const slowest = flickShot(release({ openSpeed: 9.1 }))
        const fastest = flickShot(release({ openSpeed: 199 }))
        expect(slowest?.power).toBe(0)
        expect(fastest?.power).toBeGreaterThan(0.99)
        // A mediana das 15 leituras (32,1) cai no meio da escala, não no teto como antes.
        const median = flickShot(release({ openSpeed: 32.1 }))
        expect(median?.power).toBeGreaterThan(0.3)
        expect(median?.power).toBeLessThan(0.5)
    })

    it('aponta na direção da mão', () => {
        const shot = flickShot(
            release({ openSpeed: Math.sqrt(10 * 200), direction: { x: 0.6, y: -0.8 } }),
        )
        expect(shot?.velocity.x).toBeCloseTo(420, 6)
        expect(shot?.velocity.y).toBeCloseTo(-560, 6)
    })

    it('cancela quando a abertura não foi rápida, é fraca (abaixo de 2 razão/s) ou não há direção', () => {
        expect(flickShot(release({ fast: false }))).toBeNull()
        expect(flickShot(release({ openSpeed: 1.5 }))).toBeNull()
        expect(flickShot(release({ direction: null }))).toBeNull()
    })

    it('aceita parâmetros próprios', () => {
        const shot = flickShot(release({ openSpeed: 10 }), {
            powerLowSpeed: 5,
            powerHighSpeed: 20,
            minShotSpeed: 100,
            maxShotSpeed: 200,
        })
        // 10 fica no meio de 5 a 20 em escala logarítmica.
        expect(shot?.power).toBeCloseTo(0.5, 9)
        expect(shot?.velocity.y).toBeCloseTo(-150, 6)
    })

    it('os padrões: gatilho de 80 ms, corte fraco em 2 razão/s e escala de 10 a 200', () => {
        expect(DEFAULT_FLICK.slowMs).toBe(80)
        expect(DEFAULT_FLICK.minOpenSpeed).toBe(2)
        expect(DEFAULT_FLICK.powerLowSpeed).toBe(10)
        expect(DEFAULT_FLICK.powerHighSpeed).toBe(200)
        expect(DEFAULT_FLICK).not.toHaveProperty('maxOpenSpeed')
    })
})
