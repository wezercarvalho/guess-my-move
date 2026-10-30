import { FRET_COUNT, type FretNumber, type StringNumber } from './theory.js'

/** Ponto na tela espelhada (o que o jogador vê), normalizado de 0 a 1. */
export interface ScreenPoint {
    readonly x: number
    readonly y: number
}

/** Retângulo na tela normalizada. */
export interface Rect {
    readonly x0: number
    readonly x1: number
    readonly y0: number
    readonly y1: number
}

/**
 * Onde o braço fica na tela normalizada. Destro: pestana à esquerda; canhoto espelha na
 * horizontal. A corda 6 fica em cima e a 1 embaixo nos dois casos.
 */
export interface BoardPlacement {
    readonly x: number
    readonly y: number
    readonly width: number
    readonly height: number
    readonly leftHanded?: boolean
}

/** Colocação inicial (hipótese): a calibrar ao vivo pelo ajuste do braço. */
export const DEFAULT_PLACEMENT: BoardPlacement = { x: 0.06, y: 0.3, width: 0.56, height: 0.4 }

/** Coordenadas do braço: `u` ao longo do braço (0 pestana a 1 casa 5), `v` entre as cordas (0 = corda 6, 1 = corda 1). */
export interface BoardPoint {
    readonly u: number
    readonly v: number
}

export interface Cell {
    readonly string: StringNumber
    readonly fret: FretNumber
}

/** Distância da pestana à casa `n`, relativa ao comprimento de escala: L·(1 − 2^(−n/12)). */
export function fretPosition(n: number): number {
    return 1 - 2 ** (-n / 12)
}

/** Posição das pestanas de cada casa (0 a 5) no braço normalizado: a casa 5 vale 1. */
export const FRET_EDGES: readonly number[] = Array.from(
    { length: FRET_COUNT + 1 },
    (_, n) => fretPosition(n) / fretPosition(FRET_COUNT),
)

/** Meia distância entre cordas em `v` (5 vãos entre 6 cordas). */
const HALF_STRING_GAP = 0.5 / 5

/** Passa um ponto da tela para as coordenadas do braço. */
export function toBoardPoint(point: ScreenPoint, placement: BoardPlacement): BoardPoint {
    const across = (point.x - placement.x) / placement.width
    return {
        u: placement.leftHanded ? 1 - across : across,
        v: (point.y - placement.y) / placement.height,
    }
}

/** Inverso de `toBoardPoint`: onde um ponto do braço cai na tela (para desenhar). */
export function toScreenPoint(point: BoardPoint, placement: BoardPlacement): ScreenPoint {
    const across = placement.leftHanded ? 1 - point.u : point.u
    return { x: placement.x + across * placement.width, y: placement.y + point.v * placement.height }
}

/** `v` central de uma corda. */
export function stringV(string: StringNumber): number {
    return (6 - string) / 5
}

/** Limites da célula (zona da corda e zona da casa). */
export function cellBounds(cell: Cell): { u0: number; u1: number; v0: number; v1: number } {
    const centre = stringV(cell.string)
    return {
        u0: FRET_EDGES[cell.fret - 1],
        u1: FRET_EDGES[cell.fret],
        v0: centre - HALF_STRING_GAP,
        v1: centre + HALF_STRING_GAP,
    }
}

/** Célula sob o ponto, ou `null` antes da pestana, depois da casa 5 ou fora das cordas. */
export function cellAt(point: BoardPoint): Cell | null {
    if (point.u < 0 || point.u > 1) return null
    if (point.v < -HALF_STRING_GAP || point.v > 1 + HALF_STRING_GAP) return null
    let fret = FRET_COUNT
    for (let n = 1; n <= FRET_COUNT; n++) {
        if (point.u <= FRET_EDGES[n]) {
            fret = n
            break
        }
    }
    const index = Math.min(5, Math.max(0, Math.round(point.v * 5)))
    return { string: (6 - index) as StringNumber, fret: fret as FretNumber }
}

/** O ponto está dentro da célula expandida por `margin` (fração do tamanho da célula, nos dois eixos)? */
export function insideCell(point: BoardPoint, cell: Cell, margin: number): boolean {
    const { u0, u1, v0, v1 } = cellBounds(cell)
    const du = (u1 - u0) * margin
    const dv = (v1 - v0) * margin
    return point.u >= u0 - du && point.u <= u1 + du && point.v >= v0 - dv && point.v <= v1 + dv
}

/** Faixa onde a batida conta: do outro lado do braço, cobrindo a altura das cordas com folga. */
export function strumZone(placement: BoardPlacement): Rect {
    const gap = 0.02
    const y0 = Math.max(0, placement.y - 0.1)
    const y1 = Math.min(1, placement.y + placement.height + 0.1)
    return placement.leftHanded
        ? { x0: 0, x1: Math.max(0, placement.x - gap), y0, y1 }
        : { x0: Math.min(1, placement.x + placement.width + gap), x1: 1, y0, y1 }
}

/** O ponto está dentro do retângulo? */
export function insideRect(point: ScreenPoint, rect: Rect): boolean {
    return point.x >= rect.x0 && point.x <= rect.x1 && point.y >= rect.y0 && point.y <= rect.y1
}
