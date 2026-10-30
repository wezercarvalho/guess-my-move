import {
    type BoardPlacement,
    type BoardPoint,
    type Cell,
    type ScreenPoint,
    cellAt,
    insideCell,
    toBoardPoint,
} from './board.js'
import { OneEuroFilter, type OneEuroConfig } from './oneEuro.js'
import { type FingerNumber, type FretNumber, type StringNumber } from './theory.js'

/** Um dedo apertando uma corda numa casa, já estável. */
export interface FingerPress {
    readonly finger: FingerNumber
    readonly string: StringNumber
    readonly fret: FretNumber
}

/** Estado de um dedo para a gaveta de depuração. */
export interface FingerDebug {
    readonly finger: FingerNumber
    /** Posição suavizada no braço, ou `null` se a mão não está visível. */
    readonly board: BoardPoint | null
    /** Célula candidata sob a ponta (ainda sem permanência). */
    readonly cell: Cell | null
    readonly pressed: boolean
}

export interface FingerTrackerConfig {
    /** Tempo na mesma célula para o dedo contar como apertando (ms). */
    readonly dwellMs: number
    /** Fração da célula tolerada fora dela antes de soltar. */
    readonly exitMargin: number
    /** Por quanto tempo os dedos estáveis resistem à mão sumir (ms). */
    readonly graceMs: number
    readonly filter: OneEuroConfig
}

/** Valores iniciais: hipóteses a calibrar ao vivo (ver plan.md). */
export const DEFAULT_FINGER_CONFIG: FingerTrackerConfig = {
    dwellMs: 100,
    exitMargin: 0.25,
    graceMs: 150,
    filter: { minCutoff: 1.5, beta: 0.8, dCutoff: 1 },
}

/** Pontas do indicador, médio, anelar e mindinho no modelo de 21 pontos da mão. */
const FINGERTIPS: readonly (readonly [FingerNumber, number])[] = [
    [1, 8],
    [2, 12],
    [3, 16],
    [4, 20],
]

interface FingerState {
    readonly x: OneEuroFilter
    readonly y: OneEuroFilter
    candidate: Cell | null
    since: number
    pressed: Cell | null
    board: BoardPoint | null
}

/**
 * Traduz as pontas dos dedos da mão do braço em corda e casa, **sem usar profundidade**:
 * suaviza a ponta, acha a célula sob ela e só conta como apertando depois da permanência;
 * a histerese de saída evita alternar na fronteira. O polegar não conta.
 */
export class FingerTracker {
    private readonly states = new Map<FingerNumber, FingerState>()
    private lastSeen: number | null = null
    private visible = false
    private stable: FingerPress[] = []

    constructor(private readonly config: FingerTrackerConfig = DEFAULT_FINGER_CONFIG) {
        for (const [finger] of FINGERTIPS) this.states.set(finger, this.fresh())
    }

    private fresh(): FingerState {
        return {
            x: new OneEuroFilter(this.config.filter),
            y: new OneEuroFilter(this.config.filter),
            candidate: null,
            since: 0,
            pressed: null,
            board: null,
        }
    }

    update(
        tMs: number,
        hand: readonly ScreenPoint[] | null,
        placement: BoardPlacement,
    ): FingerPress[] {
        if (!hand) {
            this.visible = false
            if (this.lastSeen !== null && tMs - this.lastSeen <= this.config.graceMs) {
                return this.stable
            }
            this.reset()
            return []
        }
        this.visible = true
        this.lastSeen = tMs
        const presses: FingerPress[] = []
        for (const [finger, tip] of FINGERTIPS) {
            const state = this.states.get(finger)!
            const point = hand[tip]
            if (!point) continue
            const board = toBoardPoint(
                { x: state.x.filter(point.x, tMs), y: state.y.filter(point.y, tMs) },
                placement,
            )
            state.board = board
            if (state.pressed && !insideCell(board, state.pressed, this.config.exitMargin)) {
                state.pressed = null
                state.candidate = null
            }
            if (!state.pressed) {
                if (state.candidate && insideCell(board, state.candidate, this.config.exitMargin)) {
                    if (tMs - state.since >= this.config.dwellMs) state.pressed = state.candidate
                } else {
                    state.candidate = cellAt(board)
                    state.since = tMs
                }
            }
            if (state.pressed) {
                presses.push({
                    finger,
                    string: state.pressed.string,
                    fret: state.pressed.fret,
                })
            }
        }
        this.stable = presses
        return presses
    }

    /** Estado atual de cada dedo para a depuração. */
    debug(): FingerDebug[] {
        return FINGERTIPS.map(([finger]) => {
            const state = this.states.get(finger)!
            return {
                finger,
                board: this.visible ? state.board : null,
                cell: state.pressed ?? state.candidate,
                pressed: state.pressed !== null,
            }
        })
    }

    reset(): void {
        for (const [finger] of FINGERTIPS) this.states.set(finger, this.fresh())
        this.lastSeen = null
        this.visible = false
        this.stable = []
    }
}
