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

    it('abertura lenta (subida acima de 300 ms) não é rápida, mesmo com um pico veloz no fim', () => {
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

describe('flickShot', () => {
    const release = (overrides: Partial<FlickRelease> = {}): FlickRelease => ({
        fast: true,
        openSpeed: 5,
        riseMs: 40,
        direction: { x: 0, y: -1 },
        ...overrides,
    })

    it('mapeia 2 a 8 razão/s para 300 a 1100 unid/s', () => {
        const low = flickShot(release({ openSpeed: 2 }))
        expect(low?.velocity.y).toBeCloseTo(-300, 6)
        expect(low?.power).toBe(0)
        const mid = flickShot(release({ openSpeed: 5 }))
        expect(mid?.velocity.y).toBeCloseTo(-700, 6)
        expect(mid?.power).toBeCloseTo(0.5, 9)
        const top = flickShot(release({ openSpeed: 8 }))
        expect(top?.velocity.y).toBeCloseTo(-1100, 6)
        expect(top?.power).toBe(1)
    })

    it('limita acima do máximo', () => {
        const shot = flickShot(release({ openSpeed: 40 }))
        expect(shot?.velocity.y).toBeCloseTo(-1100, 6)
        expect(shot?.power).toBe(1)
    })

    it('aponta na direção da mão', () => {
        const shot = flickShot(release({ openSpeed: 5, direction: { x: 0.6, y: -0.8 } }))
        expect(shot?.velocity.x).toBeCloseTo(420, 6)
        expect(shot?.velocity.y).toBeCloseTo(-560, 6)
    })

    it('cancela quando a abertura não foi rápida, é fraca ou não há direção', () => {
        expect(flickShot(release({ fast: false }))).toBeNull()
        expect(flickShot(release({ openSpeed: 1.5 }))).toBeNull()
        expect(flickShot(release({ direction: null }))).toBeNull()
    })

    it('aceita parâmetros próprios', () => {
        const shot = flickShot(release({ openSpeed: 10 }), {
            minOpenSpeed: 5,
            maxOpenSpeed: 15,
            minShotSpeed: 100,
            maxShotSpeed: 200,
        })
        expect(shot?.velocity.y).toBeCloseTo(-150, 6)
    })
})
