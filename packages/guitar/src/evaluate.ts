import { type FingerPress } from './fingers.js'
import {
    type Chord,
    type ChordId,
    type FingerNumber,
    type FretNumber,
    STRING_NUMBERS,
    type SoundingString,
    type StringNumber,
    midiOf,
} from './theory.js'

/** Estado de uma corda em relação ao acorde alvo. */
export type StringState = 'muted' | 'ok' | 'wrong' | 'missing'

export interface StringEvaluation {
    readonly string: StringNumber
    readonly state: StringState
    /** Casa pedida pelo acorde (0 = solta); `null` quando a corda é abafada. */
    readonly targetFret: number | null
    /** Casa que a mão está formando (0 = nenhum dedo, corda solta). */
    readonly detectedFret: number
    /** Dedo que está apertando, se houver. */
    readonly finger: FingerNumber | null
}

/** Uma única correção: colocar um dedo que falta, mover um que está na casa errada ou tirar um que não deve estar. */
export interface Correction {
    readonly action: 'place' | 'move' | 'remove'
    readonly finger: FingerNumber
    readonly string: StringNumber
    /** Casa alvo em `place` e `move`; casa atual do dedo em `remove`. */
    readonly fret: FretNumber
}

export interface ChordEvaluation {
    readonly chord: ChordId
    /** Uma entrada por corda, da 6 à 1. */
    readonly strings: readonly StringEvaluation[]
    readonly complete: boolean
    readonly correction: Correction | null
    /** Cordas que soam agora: as não abafadas do alvo, na casa que a mão forma. */
    readonly sounding: readonly SoundingString[]
}

export interface EvaluateOptions {
    /** Trata dedos sobre cordas que o acorde pede soltas como se não existissem (calibração). */
    readonly ignoreExtraFingers?: boolean
}

/** Dedo que vale numa corda: o da casa mais alta (como num violão real). */
function topPress(presses: readonly FingerPress[], string: StringNumber): FingerPress | null {
    let top: FingerPress | null = null
    for (const press of presses) {
        if (press.string === string && (top === null || press.fret > top.fret)) top = press
    }
    return top
}

/**
 * Compara os dedos estáveis com o acorde alvo. Determinístico: a mesma entrada dá sempre
 * a mesma saída. A correção segue a ordem: primeiro as cordas erradas (da 6 à 1), depois as
 * que faltam (da 6 à 1).
 */
export function evaluateChord(
    chord: Chord,
    presses: readonly FingerPress[],
    options: EvaluateOptions = {},
): ChordEvaluation {
    const strings: StringEvaluation[] = []
    const sounding: SoundingString[] = []
    const wrong: Correction[] = []
    const missing: Correction[] = []

    for (const string of STRING_NUMBERS) {
        const spec = chord.strings[string]
        if (spec.kind === 'muted') {
            strings.push({ string, state: 'muted', targetFret: null, detectedFret: 0, finger: null })
            continue
        }
        const top = topPress(presses, string)
        const targetFret = spec.kind === 'open' ? 0 : spec.fret
        const ignored = spec.kind === 'open' && top !== null && options.ignoreExtraFingers === true
        const detected = ignored ? null : top
        const detectedFret = detected ? detected.fret : 0

        let state: StringState
        if (spec.kind === 'open') {
            state = detected ? 'wrong' : 'ok'
        } else if (!detected) {
            state = 'missing'
        } else {
            state = detected.fret === spec.fret ? 'ok' : 'wrong'
        }
        strings.push({
            string,
            state,
            targetFret,
            detectedFret,
            finger: detected ? detected.finger : null,
        })
        sounding.push({ string, fret: detectedFret, midi: midiOf(string, detectedFret) })

        if (state === 'wrong' && detected) {
            wrong.push(
                spec.kind === 'open'
                    ? { action: 'remove', finger: detected.finger, string, fret: detected.fret }
                    : { action: 'move', finger: detected.finger, string, fret: spec.fret },
            )
        } else if (state === 'missing' && spec.kind === 'fret') {
            missing.push({ action: 'place', finger: spec.finger, string, fret: spec.fret })
        }
    }

    return {
        chord: chord.id,
        strings,
        complete: strings.every((entry) => entry.state === 'ok' || entry.state === 'muted'),
        correction: wrong[0] ?? missing[0] ?? null,
        sounding,
    }
}

export interface ChordStabilityConfig {
    /** O acorde completo precisa durar isto para virar "certo" (ms). */
    readonly holdMs: number
    /** O acorde incompleto precisa durar isto para voltar a "errado" (ms). */
    readonly releaseMs: number
}

/** Valores iniciais: hipóteses a calibrar ao vivo (ver plan.md). */
export const DEFAULT_STABILITY_CONFIG: ChordStabilityConfig = { holdMs: 250, releaseMs: 200 }

/** Segura o estado "certo" no tempo para ele não piscar com um quadro ruim. */
export class ChordStability {
    private stable = false
    private completeSince: number | null = null
    private incompleteSince: number | null = null

    constructor(private readonly config: ChordStabilityConfig = DEFAULT_STABILITY_CONFIG) {}

    update(complete: boolean, tMs: number): boolean {
        if (!this.stable) {
            if (complete) {
                this.completeSince ??= tMs
                if (tMs - this.completeSince >= this.config.holdMs) {
                    this.stable = true
                    this.incompleteSince = null
                }
            } else {
                this.completeSince = null
            }
        } else if (complete) {
            this.incompleteSince = null
        } else {
            this.incompleteSince ??= tMs
            if (tMs - this.incompleteSince >= this.config.releaseMs) {
                this.stable = false
                this.completeSince = null
            }
        }
        return this.stable
    }

    reset(): void {
        this.stable = false
        this.completeSince = null
        this.incompleteSince = null
    }
}
