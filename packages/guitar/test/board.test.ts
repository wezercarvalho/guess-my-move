import { describe, expect, it } from 'vitest'

import {
    DEFAULT_PLACEMENT,
    FRET_EDGES,
    cellAt,
    cellBounds,
    fretPosition,
    insideCell,
    strumZone,
    toBoardPoint,
} from '../src/index.js'

const board = { x: 0.1, y: 0.3, width: 0.5, height: 0.4 }

/** Ponto de tela no centro da célula pedida, para o braço `board` destro. */
function centerOf(string: 1 | 2 | 3 | 4 | 5 | 6, fret: 1 | 2 | 3 | 4 | 5) {
    const bounds = cellBounds({ string, fret })
    const u = (bounds.u0 + bounds.u1) / 2
    const v = (bounds.v0 + bounds.v1) / 2
    return { x: board.x + u * board.width, y: board.y + v * board.height }
}

describe('casas', () => {
    it('seguem a regra dos 12 semitons, com a casa 12 na metade', () => {
        const expected = [0.056126, 0.109101, 0.159104, 0.206299, 0.250846]
        expected.forEach((value, index) => {
            expect(fretPosition(index + 1)).toBeCloseTo(value, 4)
        })
        expect(fretPosition(12)).toBeCloseTo(0.5, 6)
        expect(fretPosition(0)).toBe(0)
    })

    it('as bordas normalizadas vão de 0 (pestana) a 1 (casa 5)', () => {
        expect(FRET_EDGES).toHaveLength(6)
        expect(FRET_EDGES[0]).toBe(0)
        expect(FRET_EDGES[5]).toBeCloseTo(1, 9)
        for (let index = 1; index < FRET_EDGES.length; index++) {
            expect(FRET_EDGES[index]).toBeGreaterThan(FRET_EDGES[index - 1])
        }
    })
})

describe('células de corda e casa', () => {
    it('o centro de cada célula devolve a própria corda e casa', () => {
        for (const string of [6, 5, 4, 3, 2, 1] as const) {
            for (const fret of [1, 2, 3, 4, 5] as const) {
                const point = toBoardPoint(centerOf(string, fret), board)
                expect(cellAt(point)).toEqual({ string, fret })
            }
        }
    })

    it('a corda 6 fica em cima e a corda 1 embaixo', () => {
        expect(centerOf(6, 1).y).toBeLessThan(centerOf(1, 1).y)
    })

    it('devolve nulo antes da pestana, depois da casa 5 e fora das cordas', () => {
        expect(cellAt({ u: -0.05, v: 0.5 })).toBeNull()
        expect(cellAt({ u: 1.05, v: 0.5 })).toBeNull()
        expect(cellAt({ u: 0.5, v: -0.2 })).toBeNull()
        expect(cellAt({ u: 0.5, v: 1.2 })).toBeNull()
    })

    it('as cordas externas aceitam meia casa de folga para fora', () => {
        expect(cellAt({ u: 0.5, v: -0.05 })?.string).toBe(6)
        expect(cellAt({ u: 0.5, v: 1.05 })?.string).toBe(1)
    })

    it('insideCell respeita a margem de saída proporcional à célula', () => {
        const cell = { string: 4, fret: 2 } as const
        const { u0, u1, v0, v1 } = cellBounds(cell)
        const justOutside = { u: u1 + (u1 - u0) * 0.1, v: (v0 + v1) / 2 }
        expect(insideCell(justOutside, cell, 0)).toBe(false)
        expect(insideCell(justOutside, cell, 0.25)).toBe(true)
        const farOutside = { u: u1 + (u1 - u0) * 0.5, v: (v0 + v1) / 2 }
        expect(insideCell(farOutside, cell, 0.25)).toBe(false)
    })
})

describe('posicionamento', () => {
    it('destro: a pestana fica à esquerda e a casa 5 à direita', () => {
        expect(toBoardPoint({ x: board.x, y: 0.5 }, board).u).toBeCloseTo(0, 9)
        expect(toBoardPoint({ x: board.x + board.width, y: 0.5 }, board).u).toBeCloseTo(1, 9)
    })

    it('canhoto: espelha na horizontal, com a pestana à direita', () => {
        const mirrored = { ...board, leftHanded: true }
        expect(toBoardPoint({ x: board.x + board.width, y: 0.5 }, mirrored).u).toBeCloseTo(0, 9)
        expect(toBoardPoint({ x: board.x, y: 0.5 }, mirrored).u).toBeCloseTo(1, 9)
        // verticalmente nada muda: a corda 6 continua em cima
        expect(toBoardPoint({ x: 0.3, y: board.y }, mirrored).v).toBeCloseTo(0, 9)
    })

    it('a zona de batida fica do outro lado do braço e cobre a faixa das cordas', () => {
        const right = strumZone(board)
        expect(right.x0).toBeGreaterThanOrEqual(board.x + board.width)
        expect(right.x1).toBe(1)
        expect(right.y0).toBeLessThan(board.y)
        expect(right.y1).toBeGreaterThan(board.y + board.height)
        const left = strumZone({ ...board, leftHanded: true })
        expect(left.x0).toBe(0)
        expect(left.x1).toBeLessThanOrEqual(board.x)
    })

    it('a colocação padrão cabe na tela', () => {
        const { x, y, width, height } = DEFAULT_PLACEMENT
        expect(x).toBeGreaterThanOrEqual(0)
        expect(y).toBeGreaterThanOrEqual(0)
        expect(x + width).toBeLessThan(1)
        expect(y + height).toBeLessThan(1)
    })
})
