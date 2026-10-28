import { describe, expect, it } from 'vitest'

import {
    DEFAULT_FLICK,
    type FlickDetector,
    type FlickRelease,
    type HandGesture,
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

/** Alimenta o detector com pares [tempo em ms, razão] e devolve as leituras. */
function feed(
    detector: FlickDetector,
    samples: ReadonlyArray<readonly [number, number]>,
    angleDeg = 0,
    gesture: HandGesture | null = null,
) {
    return samples.map(([t, ratio]) => detector.update(hand({ ratio, angleDeg }), 1, t, gesture))
}

/** Intervalo entre quadros novos de uma webcam de cerca de 15 quadros/s. */
const FRAME = 67

describe('createFlickDetector: armar', () => {
    it('arma com a razão baixa (<= 1,05) e expõe a direção da mão', () => {
        const detector = createFlickDetector()
        const reading = detector.update(hand({ ratio: 0.8, angleDeg: 0 }), 1, 0)
        expect(reading.handVisible).toBe(true)
        expect(reading.closed).toBe(true)
        expect(reading.direction?.y).toBeCloseTo(-1, 9)
        expect(reading.release).toBeNull()
    })

    it('mantém o ponto médio espelhado e a razão, como o detector de pinça', () => {
        const reading = createFlickDetector().update(hand({ ratio: 0.6 }), 1, 0)
        expect(reading.ratio).toBeCloseTo(0.6, 9)
        expect(reading.point?.x).toBeCloseTo(0.5, 9)
        expect(reading.point?.y).toBeCloseTo(0.5, 9)
    })

    it('a pinça apertada de antes (razão <= 0,35) também arma', () => {
        expect(createFlickDetector().update(hand({ ratio: 0.2 }), 1, 0).closed).toBe(true)
    })

    it('com o polegar já esticado (razão > 1,05) não arma, e esticado nunca dispara', () => {
        const detector = createFlickDetector()
        const readings = feed(detector, [
            [0, 1.4],
            [FRAME, 1.5],
            [2 * FRAME, 1.6],
            [3 * FRAME, 1.5],
        ])
        for (const reading of readings) {
            expect(reading.closed).toBe(false)
            expect(reading.release).toBeNull()
        }
    })

    it('entre 1,05 e 1,2 a mão armada continua armada, mas não arma sozinha', () => {
        const idle = createFlickDetector().update(hand({ ratio: 1.1 }), 1, 0)
        expect(idle.closed).toBe(false)
        const detector = createFlickDetector()
        const readings = feed(detector, [
            [0, 0.9],
            [FRAME, 1.1],
        ])
        expect(readings[1]?.closed).toBe(true)
    })

    it('sem mão devolve leitura vazia', () => {
        const reading = createFlickDetector().update(null, 1, 0)
        expect(reading).toMatchObject({
            handVisible: false,
            closed: false,
            phase: 'idle',
            ratio: null,
            point: null,
            direction: null,
            gesture: null,
            release: null,
        })
    })
})

describe('createFlickDetector: estalo', () => {
    it('estalo real (0,84 -> 1,37 -> 2,03 -> 1,61): confirma na terceira amostra esticada, com velocidade de pico e subida', () => {
        const detector = createFlickDetector()
        const readings = feed(detector, [
            [0, 0.84],
            [FRAME, 0.83],
            [2 * FRAME, 1.37],
            [3 * FRAME, 2.03],
            [4 * FRAME, 1.61],
        ])
        expect(readings[2]?.release).toBeNull()
        expect(readings[3]?.release).toBeNull()
        const release = readings[4]?.release as FlickRelease
        expect(release.verdict).toBe('confirmed')
        expect(release.openSpeed).toBeCloseTo((2.03 - 1.37) / (FRAME / 1000), 6)
        expect(release.riseMs).toBe(FRAME)
    })

    it('enquanto confirma, a mão continua armada; depois da confirmação, desarmada', () => {
        const detector = createFlickDetector()
        const readings = feed(detector, [
            [0, 0.8],
            [FRAME, 1.5],
            [2 * FRAME, 1.6],
            [3 * FRAME, 1.5],
        ])
        expect(readings[1]?.closed).toBe(true)
        expect(readings[2]?.closed).toBe(true)
        expect(readings[3]?.release?.verdict).toBe('confirmed')
        expect(readings[3]?.closed).toBe(false)
    })

    it('oscilação do rastreamento com a mão fechada em movimento (sobe e volta) não confirma', () => {
        const detector = createFlickDetector()
        const readings = feed(detector, [
            [0, 0.3],
            [FRAME, 0.33],
            [2 * FRAME, 1.35],
            [3 * FRAME, 1.26],
            [4 * FRAME, 1.05],
        ])
        expect(readings[2]?.release).toBeNull()
        expect(readings[3]?.release).toBeNull()
        expect(readings[4]?.release?.verdict).toBe('unsustained')
        expect(readings[4]?.release && flickShot(readings[4].release)).toBeNull()
    })

    it('uma subida de um só quadro que volta no quadro seguinte é não sustentada', () => {
        const detector = createFlickDetector()
        const readings = feed(detector, [
            [0, 0.2],
            [FRAME, 0.9],
            [2 * FRAME, 1.5],
            [3 * FRAME, 0.6],
        ])
        expect(readings[3]?.release?.verdict).toBe('unsustained')
    })

    it('depois de não sustentar, a razão baixa rearma a mão', () => {
        const detector = createFlickDetector()
        const readings = feed(detector, [
            [0, 0.5],
            [FRAME, 1.4],
            [2 * FRAME, 0.7],
        ])
        expect(readings[2]?.release?.verdict).toBe('unsustained')
        expect(readings[2]?.closed).toBe(true)
    })

    it('subida pequena (a razão derivou até 1,2) é fraca e cancela', () => {
        const detector = createFlickDetector()
        const readings = feed(detector, [
            [0, 1.0],
            [FRAME, 1.02],
            [2 * FRAME, 1.25],
        ])
        expect(readings[2]?.release?.verdict).toBe('weak')
        expect(readings[2]?.closed).toBe(false)
    })

    it('a base da subida é o mínimo recente: o valor baixo antigo, fora da janela, não conta', () => {
        const detector = createFlickDetector()
        const readings = feed(detector, [
            [0, 0.5],
            [300, 1.0],
            [367, 1.0],
            [433, 1.3],
        ])
        expect(readings[3]?.release?.verdict).toBe('weak')
    })

    it('a base dentro da janela vale mesmo que a razão tenha voltado a subir um pouco antes do estalo', () => {
        const detector = createFlickDetector()
        const readings = feed(detector, [
            [0, 1.0],
            [FRAME, 0.6],
            [2 * FRAME, 0.9],
            [3 * FRAME, 1.3],
            [4 * FRAME, 1.4],
            [5 * FRAME, 1.5],
        ])
        const release = readings[5]?.release as FlickRelease
        expect(release.verdict).toBe('confirmed')
        expect(release.riseMs).toBe(2 * FRAME)
    })

    it('a direção do tiro é a medida na base da subida, não a do fim do estalo', () => {
        const detector = createFlickDetector()
        detector.update(hand({ ratio: 0.8, angleDeg: 90 }), 1, 0)
        detector.update(hand({ ratio: 0.8, angleDeg: 90 }), 1, FRAME)
        detector.update(hand({ ratio: 1.5, angleDeg: 0 }), 1, 2 * FRAME)
        detector.update(hand({ ratio: 1.6, angleDeg: 0 }), 1, 3 * FRAME)
        const release = detector.update(hand({ ratio: 1.5, angleDeg: 0 }), 1, 4 * FRAME).release
        expect(release?.direction?.x).toBeCloseTo(-1, 6)
        expect(release?.direction?.y).toBeCloseTo(0, 6)
    })

    it('depois de confirmar, o detector só dispara de novo ao rearmar com a razão baixa', () => {
        const detector = createFlickDetector()
        const first = feed(detector, [
            [0, 0.8],
            [FRAME, 1.5],
            [2 * FRAME, 1.6],
            [3 * FRAME, 1.5],
        ])
        expect(first[3]?.release?.verdict).toBe('confirmed')
        const stretched = feed(detector, [
            [4 * FRAME, 1.5],
            [5 * FRAME, 1.6],
            [6 * FRAME, 1.7],
        ])
        for (const reading of stretched) expect(reading.release).toBeNull()
        const second = feed(detector, [
            [7 * FRAME, 0.8],
            [8 * FRAME, 1.5],
            [9 * FRAME, 1.6],
            [10 * FRAME, 1.5],
        ])
        expect(second[3]?.release?.verdict).toBe('confirmed')
    })

    it('perder a mão zera o armado: reaparecer esticada não dispara', () => {
        const detector = createFlickDetector()
        detector.update(hand({ ratio: 0.8 }), 1, 0)
        expect(detector.update(null, 1, FRAME).closed).toBe(false)
        const readings = feed(detector, [
            [2 * FRAME, 1.5],
            [3 * FRAME, 1.6],
            [4 * FRAME, 1.5],
        ])
        for (const reading of readings) expect(reading.release).toBeNull()
    })

    it('perder a mão no meio da confirmação descarta o candidato sem soltura', () => {
        const detector = createFlickDetector()
        detector.update(hand({ ratio: 0.8 }), 1, 0)
        detector.update(hand({ ratio: 1.5 }), 1, FRAME)
        detector.update(null, 1, 2 * FRAME)
        const readings = feed(detector, [
            [3 * FRAME, 1.6],
            [4 * FRAME, 1.5],
        ])
        for (const reading of readings) expect(reading.release).toBeNull()
    })

    it('a etapa acompanha o estalo: idle, armed, pending e de volta a idle', () => {
        const detector = createFlickDetector()
        const readings = feed(detector, [
            [0, 1.4],
            [FRAME, 0.8],
            [2 * FRAME, 1.5],
            [3 * FRAME, 1.6],
            [4 * FRAME, 1.5],
        ])
        expect(readings.map((reading) => reading.phase)).toEqual([
            'idle',
            'armed',
            'pending',
            'pending',
            'idle',
        ])
    })

    it('palma aberta durante a confirmação é a mão se abrindo: não dispara', () => {
        const detector = createFlickDetector()
        const palm: HandGesture = { name: 'Open_Palm', score: 0.95 }
        const readings = feed(
            detector,
            [
                [0, 0.8],
                [FRAME, 1.5],
                [2 * FRAME, 1.6],
                [3 * FRAME, 1.5],
            ],
            0,
            palm,
        )
        const release = readings[3]?.release as FlickRelease
        expect(release.verdict).toBe('open_hand')
        expect(flickShot(release)).toBeNull()
    })

    it('polegar para cima, punho ou nenhum gesto não cancelam; palma aberta com pontuação baixa (0,63, como nos estalos reais) também não', () => {
        for (const gesture of [
            { name: 'Thumb_Up', score: 0.9 },
            { name: 'Closed_Fist', score: 0.9 },
            { name: 'None', score: 0.9 },
            { name: 'Open_Palm', score: 0.63 },
            null,
        ]) {
            const detector = createFlickDetector()
            const readings = feed(
                detector,
                [
                    [0, 0.8],
                    [FRAME, 1.5],
                    [2 * FRAME, 1.6],
                    [3 * FRAME, 1.5],
                ],
                0,
                gesture,
            )
            expect(readings[3]?.release?.verdict).toBe('confirmed')
        }
    })

    it('uma palma aberta em qualquer amostra da confirmação basta para cancelar', () => {
        const detector = createFlickDetector()
        detector.update(hand({ ratio: 0.8 }), 1, 0, { name: 'Closed_Fist', score: 0.9 })
        detector.update(hand({ ratio: 1.5 }), 1, FRAME, { name: 'None', score: 0.8 })
        detector.update(hand({ ratio: 1.6 }), 1, 2 * FRAME, { name: 'Open_Palm', score: 0.9 })
        const release = detector.update(hand({ ratio: 1.5 }), 1, 3 * FRAME, {
            name: 'Thumb_Up',
            score: 0.8,
        }).release
        expect(release?.verdict).toBe('open_hand')
    })

    it('a leitura devolve o gesto do quadro', () => {
        const gesture: HandGesture = { name: 'Closed_Fist', score: 0.7 }
        const reading = createFlickDetector().update(hand({ ratio: 0.8 }), 1, 0, gesture)
        expect(reading.gesture).toEqual(gesture)
        expect(createFlickDetector().update(hand({ ratio: 0.8 }), 1, 0).gesture).toBeNull()
    })

    it('com confirmSamples = 1 confirma no cruzamento', () => {
        const detector = createFlickDetector({ confirmSamples: 1 })
        const readings = feed(detector, [
            [0, 0.8],
            [FRAME, 1.5],
        ])
        expect(readings[1]?.release?.verdict).toBe('confirmed')
    })

    it('reset volta ao estado inicial', () => {
        const detector = createFlickDetector()
        detector.update(hand({ ratio: 0.8 }), 1, 0)
        detector.reset()
        expect(detector.update(hand({ ratio: 1.5 }), 1, FRAME).closed).toBe(false)
    })
})

describe('flickShot: força pelo polegar, em escala logarítmica', () => {
    const release = (overrides: Partial<FlickRelease> = {}): FlickRelease => ({
        verdict: 'confirmed',
        openSpeed: 8,
        riseMs: 67,
        direction: { x: 1, y: 0 },
        ...overrides,
    })

    it('mapeia 3 a 20 razão/s para 300 a 1100 unid/s, em escala logarítmica', () => {
        const low = flickShot(release({ openSpeed: 3 }))
        expect(low?.power).toBeCloseTo(0, 9)
        expect(low?.velocity.x).toBeCloseTo(300, 6)
        const high = flickShot(release({ openSpeed: 20 }))
        expect(high?.power).toBeCloseTo(1, 9)
        expect(high?.velocity.x).toBeCloseTo(1100, 6)
        const middle = flickShot(release({ openSpeed: Math.sqrt(3 * 20) }))
        expect(middle?.power).toBeCloseTo(0.5, 9)
        expect(middle?.velocity.x).toBeCloseTo(700, 6)
    })

    it('a força cresce com a velocidade e dobrar a velocidade soma sempre o mesmo à força', () => {
        const a = flickShot(release({ openSpeed: 4 }))?.power ?? 0
        const b = flickShot(release({ openSpeed: 8 }))?.power ?? 0
        const c = flickShot(release({ openSpeed: 16 }))?.power ?? 0
        expect(b).toBeGreaterThan(a)
        expect(c).toBeGreaterThan(b)
        expect(b - a).toBeCloseTo(c - b, 9)
    })

    it('limita abaixo e acima da escala sem cancelar o tiro confirmado', () => {
        expect(flickShot(release({ openSpeed: 0.5 }))?.power).toBe(0)
        expect(flickShot(release({ openSpeed: 500 }))?.power).toBe(1)
        expect(flickShot(release({ openSpeed: 0 }))?.power).toBe(0)
    })

    it('os estalos reais medidos (de 5 a 10 razão/s) caem no meio da escala', () => {
        const weak = flickShot(release({ openSpeed: 5 }))?.power ?? 0
        const strong = flickShot(release({ openSpeed: 10 }))?.power ?? 0
        expect(weak).toBeGreaterThan(0.2)
        expect(weak).toBeLessThan(0.35)
        expect(strong).toBeGreaterThan(0.55)
        expect(strong).toBeLessThan(0.7)
    })

    it('aponta na direção da mão', () => {
        const shot = flickShot(release({ openSpeed: 20, direction: { x: 0, y: -1 } }))
        expect(shot?.velocity.x).toBeCloseTo(0, 9)
        expect(shot?.velocity.y).toBeCloseTo(-1100, 6)
    })

    it('cancela quando o estalo é fraco, não foi sustentado ou não há direção', () => {
        expect(flickShot(release({ verdict: 'weak' }))).toBeNull()
        expect(flickShot(release({ verdict: 'unsustained' }))).toBeNull()
        expect(flickShot(release({ verdict: 'open_hand' }))).toBeNull()
        expect(flickShot(release({ direction: null }))).toBeNull()
    })

    it('aceita parâmetros próprios', () => {
        const shot = flickShot(release({ openSpeed: 100 }), {
            powerLowSpeed: 10,
            powerHighSpeed: 1000,
            minShotSpeed: 100,
            maxShotSpeed: 500,
        })
        expect(shot?.power).toBeCloseTo(0.5, 9)
        expect(shot?.velocity.x).toBeCloseTo(300, 6)
    })

    it('os padrões: arma em 1,05, estica em 1,2 por 3 amostras, subida mínima de 0,4, palma aberta cancela e escala de 3 a 20', () => {
        expect(DEFAULT_FLICK.openHandGesture).toBe('Open_Palm')
        expect(DEFAULT_FLICK.gestureMinScore).toBe(0.8)
        expect(DEFAULT_FLICK.armRatio).toBe(1.05)
        expect(DEFAULT_FLICK.extendRatio).toBe(1.2)
        expect(DEFAULT_FLICK.confirmSamples).toBe(3)
        expect(DEFAULT_FLICK.minRise).toBe(0.4)
        expect(DEFAULT_FLICK.powerLowSpeed).toBe(3)
        expect(DEFAULT_FLICK.powerHighSpeed).toBe(20)
        expect(DEFAULT_FLICK.minShotSpeed).toBe(300)
        expect(DEFAULT_FLICK.maxShotSpeed).toBe(1100)
    })
})
