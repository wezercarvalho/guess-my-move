import { describe, expect, it } from 'vitest'

import {
    type BoardPlacement,
    type Cell,
    DEFAULT_FINGER_CONFIG,
    type FingerNumber,
    FingerTracker,
    type ScreenPoint,
    cellBounds,
} from '../src/index.js'

const board: BoardPlacement = { x: 0.1, y: 0.3, width: 0.5, height: 0.4 }
const FAR: ScreenPoint = { x: 0.95, y: 0.95 }
const TIPS: Record<FingerNumber, number> = { 1: 8, 2: 12, 3: 16, 4: 20 }

/** Ponto de tela do centro de uma célula (braço destro, ou espelhado se `leftHanded`). */
function centre(cell: Cell, placement: BoardPlacement = board, du = 0, dv = 0): ScreenPoint {
    const { u0, u1, v0, v1 } = cellBounds(cell)
    const u = (u0 + u1) / 2 + du
    const v = (v0 + v1) / 2 + dv
    const across = placement.leftHanded ? 1 - u : u
    return { x: placement.x + across * placement.width, y: placement.y + v * placement.height }
}

/** Mão de 21 pontos longe do braço, com as pontas dos dedos nas posições pedidas. */
function handWith(tips: Partial<Record<FingerNumber, ScreenPoint>>, thumb?: ScreenPoint): ScreenPoint[] {
    const points = Array.from({ length: 21 }, () => FAR)
    for (const [finger, point] of Object.entries(tips)) {
        points[TIPS[Number(finger) as FingerNumber]] = point
    }
    if (thumb) points[4] = thumb
    return points
}

/** Alimenta o rastreador por `frames` quadros de 33 ms a partir de `from` e devolve a última saída. */
function feed(
    tracker: FingerTracker,
    hand: ScreenPoint[] | null,
    from: number,
    frames: number,
    placement: BoardPlacement = board,
) {
    let out = tracker.update(from, hand, placement)
    for (let i = 1; i < frames; i++) out = tracker.update(from + i * 33, hand, placement)
    return out
}

describe('FingerTracker', () => {
    const cell: Cell = { string: 4, fret: 2 }

    it('só reporta o dedo depois do tempo de permanência', () => {
        const tracker = new FingerTracker()
        const hand = handWith({ 2: centre(cell) })
        // 3 quadros = 66 ms: ainda não
        expect(feed(tracker, hand, 1000, 3)).toEqual([])
        // 5 quadros = 132 ms: já
        expect(feed(new FingerTracker(), hand, 1000, 5)).toEqual([
            { finger: 2, string: 4, fret: 2 },
        ])
    })

    it('reporta vários dedos, em ordem de dedo', () => {
        const tracker = new FingerTracker()
        const hand = handWith({
            3: centre({ string: 4, fret: 2 }),
            2: centre({ string: 5, fret: 2 }),
        })
        expect(feed(tracker, hand, 1000, 6)).toEqual([
            { finger: 2, string: 5, fret: 2 },
            { finger: 3, string: 4, fret: 2 },
        ])
    })

    it('o tremor rápido na fronteira entre cordas não alterna o resultado (filtro mais histerese)', () => {
        const tracker = new FingerTracker()
        feed(tracker, handWith({ 2: centre(cell) }), 1000, 6)
        // empurra a ponta 0,11 (em v) para cima e para baixo: cruza a fronteira por pouco
        let t = 1200
        for (let i = 0; i < 24; i++) {
            const dv = i % 2 === 0 ? -0.11 : 0.11
            const out = tracker.update(t, handWith({ 2: centre(cell, board, 0, dv) }), board)
            t += 33
            expect(out).toEqual([{ finger: 2, string: 4, fret: 2 }])
        }
    })

    it('a ponta que passa um pouco da fronteira e fica ali não solta o dedo (histerese)', () => {
        const tracker = new FingerTracker()
        feed(tracker, handWith({ 2: centre(cell) }), 1000, 6)
        // 0,13 em v: 0,03 além da fronteira (0,10), dentro da margem de 25% da célula (0,05)
        const out = feed(tracker, handWith({ 2: centre(cell, board, 0, 0.13) }), 1200, 30)
        expect(out).toEqual([{ finger: 2, string: 4, fret: 2 }])
    })

    it('sem a margem de saída a mesma posição soltaria o dedo', () => {
        const tracker = new FingerTracker({ ...DEFAULT_FINGER_CONFIG, exitMargin: 0 })
        feed(tracker, handWith({ 2: centre(cell) }), 1000, 6)
        const out = feed(tracker, handWith({ 2: centre(cell, board, 0, 0.13) }), 1200, 30)
        expect(out).not.toContainEqual({ finger: 2, string: 4, fret: 2 })
    })

    it('um dedo que sai de vez do braço é solto', () => {
        const tracker = new FingerTracker()
        feed(tracker, handWith({ 2: centre(cell) }), 1000, 6)
        const out = feed(tracker, handWith({ 2: FAR }), 1300, 3)
        expect(out).toEqual([])
    })

    it('ignora o polegar e pontas fora do braço', () => {
        const tracker = new FingerTracker()
        const hand = handWith({ 2: { x: 0.9, y: 0.5 } }, centre({ string: 3, fret: 1 }))
        expect(feed(tracker, hand, 1000, 8)).toEqual([])
    })

    it('ignora a ponta antes da pestana e depois da casa 5', () => {
        const tracker = new FingerTracker()
        const before = { x: board.x - 0.03, y: board.y + 0.1 }
        const after = { x: board.x + board.width + 0.03, y: board.y + 0.1 }
        expect(feed(tracker, handWith({ 1: before, 4: after }), 1000, 8)).toEqual([])
    })

    it('mantém os dedos estáveis quando a mão some por menos que a tolerância', () => {
        const tracker = new FingerTracker()
        feed(tracker, handWith({ 2: centre(cell) }), 1000, 6)
        const last = 1000 + 5 * 33
        expect(tracker.update(last + 100, null, board)).toEqual([
            { finger: 2, string: 4, fret: 2 },
        ])
    })

    it('zera os dedos quando a mão some por mais que a tolerância', () => {
        const tracker = new FingerTracker()
        feed(tracker, handWith({ 2: centre(cell) }), 1000, 6)
        const last = 1000 + 5 * 33
        expect(tracker.update(last + 400, null, board)).toEqual([])
        // e ao voltar, precisa cumprir a permanência de novo
        expect(tracker.update(last + 433, handWith({ 2: centre(cell) }), board)).toEqual([])
    })

    it('braço canhoto: a mesma célula espelhada é reconhecida', () => {
        const mirrored = { ...board, leftHanded: true }
        const tracker = new FingerTracker()
        const hand = handWith({ 2: centre(cell, mirrored) })
        expect(feed(tracker, hand, 1000, 6, mirrored)).toEqual([{ finger: 2, string: 4, fret: 2 }])
    })

    it('expõe a célula candidata de cada dedo para a depuração', () => {
        const tracker = new FingerTracker()
        tracker.update(1000, handWith({ 2: centre(cell) }), board)
        const debug = tracker.debug()
        expect(debug.find((entry) => entry.finger === 2)?.cell).toEqual(cell)
        expect(debug.find((entry) => entry.finger === 2)?.pressed).toBe(false)
        expect(debug).toHaveLength(4)
    })

    it('reset limpa tudo', () => {
        const tracker = new FingerTracker()
        feed(tracker, handWith({ 2: centre(cell) }), 1000, 6)
        tracker.reset()
        expect(tracker.update(2000, handWith({ 2: centre(cell) }), board)).toEqual([])
    })
})
