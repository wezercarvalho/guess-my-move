import {
    type BoardPlacement,
    type Cell,
    DEFAULT_PLACEMENT,
    cellBounds,
} from '@guess-my-move/guitar'

import { type TrackedHand } from '../tracker/handTracker.js'

/** Índices das pontas do indicador, médio, anelar e mindinho no modelo de 21 pontos. */
const TIPS = [8, 12, 16, 20]

/** Landmark da câmera (não espelhado) a partir de um ponto da tela espelhada. */
export const camera = (x: number, y: number) => ({ x: 1 - x, y })

/** Ponto da tela espelhada no centro de uma célula do braço. */
export function screenPoint(cell: Cell, placement: BoardPlacement) {
    const { u0, u1, v0, v1 } = cellBounds(cell)
    const u = (u0 + u1) / 2
    const across = placement.leftHanded ? 1 - u : u
    return {
        x: placement.x + across * placement.width,
        y: placement.y + ((v0 + v1) / 2) * placement.height,
    }
}

/** Mão do braço: pulso na borda e as pontas nas células pedidas, um dedo por célula, do indicador em diante. */
export function fretHand(
    cells: readonly Cell[],
    placement: BoardPlacement = DEFAULT_PLACEMENT,
): TrackedHand {
    const wristX = placement.leftHanded ? 0.97 : 0.03
    const landmarks = Array.from({ length: 21 }, () => camera(wristX, 0.7))
    cells.forEach((cell, index) => {
        const p = screenPoint(cell, placement)
        landmarks[TIPS[index]] = camera(p.x, p.y)
    })
    return { landmarks }
}

/** Mão da batida: palma em `y` e pulso 0,15 abaixo, a 0,85 da largura (ou onde pedir). */
export function strumHand(y: number, x = 0.85): TrackedHand {
    const landmarks = Array.from({ length: 21 }, () => camera(x, y))
    landmarks[0] = camera(x, y + 0.15)
    return { landmarks }
}

/** Curva suave de 0 a 1 (3s² − 2s³), para o perfil de um golpe. */
export const smooth = (s: number) => {
    const c = Math.min(1, Math.max(0, s))
    return 3 * c * c - 2 * c * c * c
}

/** As células do Em: dedo 1 na corda 5 e dedo 2 na corda 4, as duas na casa 2. */
export const EM: Cell[] = [
    { string: 5, fret: 2 },
    { string: 4, fret: 2 },
]
