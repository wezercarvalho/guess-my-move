import { describe, expect, it } from 'vitest'

import {
    type HandPoint,
    handMetrics,
    handSide,
    isFist,
    isOpenPalm,
    isThumbDownOpenHand,
    isWebPose,
    webSignal,
} from '../src/pose.js'

interface Fingers {
    thumb: boolean
    index: boolean
    middle: boolean
    ring: boolean
    pinky: boolean
}

const WRIST = { x: 0.5, y: 0.8 }

/** Mão com os dedos para cima; `true` = dedo esticado. A ordem dos landmarks é a do MediaPipe. */
function hand(fingers: Fingers, angle = 0, mirror = false): HandPoint[] {
    const points: HandPoint[] = new Array<HandPoint>(21).fill({ x: 0, y: 0 })
    points[0] = WRIST
    const finger = (first: number, x: number, open: boolean) => {
        points[first] = { x, y: 0.6 }
        points[first + 1] = { x, y: open ? 0.53 : 0.54 }
        points[first + 2] = { x, y: open ? 0.47 : 0.57 }
        points[first + 3] = { x, y: open ? 0.4 : 0.58 }
    }
    finger(5, 0.44, fingers.index)
    finger(9, 0.5, fingers.middle)
    finger(13, 0.56, fingers.ring)
    finger(17, 0.62, fingers.pinky)
    points[1] = { x: 0.46, y: 0.76 }
    points[2] = { x: 0.41, y: 0.7 }
    points[3] = { x: fingers.thumb ? 0.34 : 0.45, y: fingers.thumb ? 0.65 : 0.64 }
    points[4] = { x: fingers.thumb ? 0.26 : 0.47, y: fingers.thumb ? 0.6 : 0.62 }
    return points.map((point) => {
        const dx = point.x - WRIST.x
        const dy = point.y - WRIST.y
        const x = WRIST.x + dx * Math.cos(angle) - dy * Math.sin(angle)
        const y = WRIST.y + dx * Math.sin(angle) + dy * Math.cos(angle)
        return { x: mirror ? 1 - x : x, y }
    })
}

const WEB = { thumb: true, index: true, middle: false, ring: false, pinky: true }

describe('isWebPose', () => {
    it('reconhece polegar, indicador e mindinho abertos com médio e anelar dobrados', () => {
        expect(isWebPose(hand(WEB))).toBe(true)
    })

    it.each([90, 180, 270, 45, -60])('não depende da orientação da mão (%i°)', (degrees) => {
        expect(isWebPose(hand(WEB, (degrees * Math.PI) / 180))).toBe(true)
    })

    it('vale para a mão espelhada (esquerda ou direita)', () => {
        expect(isWebPose(hand(WEB, 0, true))).toBe(true)
        expect(isWebPose(hand(WEB, Math.PI / 2, true))).toBe(true)
    })

    it.each([
        ['palma aberta', { thumb: true, index: true, middle: true, ring: true, pinky: true }],
        ['punho', { thumb: false, index: false, middle: false, ring: false, pinky: false }],
        ['chifres sem polegar', { thumb: false, index: true, middle: false, ring: false, pinky: true }],
        ['apontar', { thumb: false, index: true, middle: false, ring: false, pinky: false }],
        ['polegar para cima', { thumb: true, index: false, middle: false, ring: false, pinky: false }],
        ['V', { thumb: false, index: true, middle: true, ring: false, pinky: false }],
    ])('rejeita %s', (_name, fingers) => {
        expect(isWebPose(hand(fingers))).toBe(false)
    })

    it('rejeita mão incompleta', () => {
        expect(isWebPose([])).toBe(false)
        expect(isWebPose(hand(WEB).slice(0, 10))).toBe(false)
    })
})

describe('handSide', () => {
    it('usa o lado da tela espelhada: mão à esquerda na imagem espelhada é a esquerda', () => {
        const base = hand(WEB)
        const left = base.map((p) => ({ x: p.x - 0.3 + 0.0, y: p.y }))
        const right = base.map((p) => ({ x: p.x + 0.3, y: p.y }))
        // A imagem da câmera é invertida: x pequeno aparece à direita na tela.
        expect(handSide(left)).toBe('right')
        expect(handSide(right)).toBe('left')
    })
})

const PALM = { thumb: true, index: true, middle: true, ring: true, pinky: true }
const FIST = { thumb: false, index: false, middle: false, ring: false, pinky: false }

describe('isOpenPalm e isFist', () => {
    it('reconhecem a palma aberta e o punho em qualquer orientação', () => {
        for (const angle of [0, Math.PI / 2, Math.PI, 1]) {
            expect(isOpenPalm(hand(PALM, angle))).toBe(true)
            expect(isFist(hand(FIST, angle))).toBe(true)
        }
    })

    it('a pose de teia não é palma aberta nem punho', () => {
        expect(isOpenPalm(hand(WEB))).toBe(false)
        expect(isFist(hand(WEB))).toBe(false)
    })

    it('rejeitam mão incompleta', () => {
        expect(isOpenPalm([])).toBe(false)
        expect(isFist([])).toBe(false)
    })
})

describe('profundidade (z)', () => {
    /** Mão vista de lado: os dedos esticados apontam para a câmera, então no plano parecem curtos. */
    function towardCamera(): HandPoint[] {
        return hand(WEB).map((point, i) => {
            const stretched = [8, 7, 6, 20, 19, 18].includes(i)
            if (!stretched) return { ...point, z: 0 }
            const mcp = hand(WEB)[i <= 8 ? 5 : 17]
            return { x: mcp.x, y: mcp.y - 0.01, z: -0.002 * (i % 4) - 0.3 }
        })
    }

    it('um dedo apontado para a câmera continua esticado', () => {
        const flat = towardCamera().map(({ x, y }) => ({ x, y }))
        expect(isWebPose(flat)).toBe(false)
        expect(isWebPose(towardCamera())).toBe(true)
    })

    it('as medidas saem do mesmo cálculo da pose', () => {
        const m = handMetrics(hand(WEB))
        expect(m?.index).toBeGreaterThan(1.5)
        expect(m?.middle).toBeLessThan(1.3)
        expect(handMetrics([])).toBeNull()
    })
})

describe('webSignal', () => {
    const neutral = hand({ thumb: false, index: true, middle: true, ring: false, pinky: false })

    it('a pose geométrica vale como o gesto de teia, mesmo sem rótulo', () => {
        expect(webSignal(hand(WEB), null)).toEqual({ name: 'ILoveYou', score: 1 })
    })

    it('a palma aberta e o punho valem pela geometria, com pontuação máxima', () => {
        expect(webSignal(hand(PALM), null)).toEqual({ name: 'Open_Palm', score: 1 })
        expect(webSignal(hand(FIST), null)).toEqual({ name: 'Closed_Fist', score: 1 })
    })

    it('fora da geometria, o rótulo do reconhecedor vale como está', () => {
        expect(webSignal(neutral, { name: 'ILoveYou', score: 0.9 })).toEqual({ name: 'ILoveYou', score: 0.9 })
        expect(webSignal(neutral, { name: 'Closed_Fist', score: 0.8 })).toEqual({ name: 'Closed_Fist', score: 0.8 })
        expect(webSignal(neutral, null)).toBeNull()
    })

    it('o rótulo Open_Palm do reconhecedor, sem a geometria, não solta a teia', () => {
        expect(webSignal(neutral, { name: 'Open_Palm', score: 0.99 })).toBeNull()
    })
})

const DEG = Math.PI / 180

/**
 * Dados sintéticos (declarado): `hand(PALM, -90°)` é a mão aberta de lado, dedos para a
 * esquerda da imagem e o dedão para baixo, como na foto do maintainer. O espelho dá a outra mão.
 */
describe('isThumbDownOpenHand', () => {
    it('reconhece a mão aberta com o dedão para baixo, de lado', () => {
        expect(isThumbDownOpenHand(hand(PALM, -90 * DEG))).toBe(true)
    })

    it('vale para a mão espelhada (esquerda ou direita)', () => {
        expect(isThumbDownOpenHand(hand(PALM, -90 * DEG, true))).toBe(true)
        expect(isThumbDownOpenHand(hand(PALM, -110 * DEG, true))).toBe(true)
        // O espelho inverte só o eixo horizontal: de lado com o dedão para cima continua não valendo.
        expect(isThumbDownOpenHand(hand(PALM, 90 * DEG, true))).toBe(false)
    })

    it.each([-70, -90, -110, -135])('vale com a mão inclinada (%i°)', (degrees) => {
        expect(isThumbDownOpenHand(hand(PALM, degrees * DEG))).toBe(true)
    })

    it.each([
        ['palma em pé', hand(PALM, 0)],
        ['palma em pé espelhada', hand(PALM, 0, true)],
        ['palma levemente inclinada', hand(PALM, -30 * DEG)],
        ['palma de lado com o dedão para cima', hand(PALM, 90 * DEG)],
        ['palma de cabeça para baixo', hand(PALM, 180 * DEG)],
        ['punho de lado', hand(FIST, -90 * DEG)],
        ['pose de teia de lado', hand(WEB, -90 * DEG)],
        ['palma de lado com o dedão recolhido', hand({ ...PALM, thumb: false }, -90 * DEG)],
    ])('rejeita %s', (_name, landmarks) => {
        expect(isThumbDownOpenHand(landmarks)).toBe(false)
    })

    it('rejeita mão incompleta', () => {
        expect(isThumbDownOpenHand([])).toBe(false)
        expect(isThumbDownOpenHand(hand(PALM, -90 * DEG).slice(0, 10))).toBe(false)
    })
})
