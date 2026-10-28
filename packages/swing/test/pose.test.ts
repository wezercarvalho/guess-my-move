import { describe, expect, it } from 'vitest'

import { type HandPoint } from '../src/steering.js'
import { handSide, isWebPose, webSignal } from '../src/pose.js'

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

describe('webSignal', () => {
    it('a pose geométrica vale como o gesto de teia, mesmo sem rótulo', () => {
        expect(webSignal(hand(WEB), null)).toEqual({ name: 'ILoveYou', score: 1 })
    })

    it('o rótulo ILoveYou do reconhecedor também vale', () => {
        const fist = hand({ thumb: false, index: false, middle: false, ring: false, pinky: false })
        expect(webSignal(fist, { name: 'ILoveYou', score: 0.9 })).toEqual({ name: 'ILoveYou', score: 0.9 })
    })

    it('sem a pose, devolve o rótulo do reconhecedor como está', () => {
        const fist = hand({ thumb: false, index: false, middle: false, ring: false, pinky: false })
        expect(webSignal(fist, { name: 'Closed_Fist', score: 0.8 })).toEqual({ name: 'Closed_Fist', score: 0.8 })
        expect(webSignal(fist, null)).toBeNull()
    })
})
