import { CHORDS } from './chords.js'
import { type FingerPress } from './fingers.js'
import { type Chord, type ChordId, STRING_NUMBERS, type StringNumber } from './theory.js'

/** Em cada corda, a casa mais alta define a posição efetiva. */
function topPress(presses: readonly FingerPress[], string: StringNumber): FingerPress | null {
    let top: FingerPress | null = null
    for (const press of presses) {
        if (press.string === string && (top === null || press.fret > top.fret)) top = press
    }
    return top
}

export interface ChordRecognitionConfig {
    /** Tempo em que a mesma forma deve permanecer antes de ser reconhecida (ms). */
    readonly holdMs: number
    /** Tolerância sem forma válida antes de apagar o acorde reconhecido (ms). */
    readonly releaseMs: number
}

export const DEFAULT_RECOGNITION_CONFIG: ChordRecognitionConfig = {
    holdMs: 100,
    releaseMs: 250,
}

/** Forma observada: uma única casa efetiva por corda, sem depender do número do dedo. */
function pressShape(presses: readonly FingerPress[]): string {
    return STRING_NUMBERS.map((string) => topPress(presses, string))
        .filter((press): press is FingerPress => press !== null)
        .map((press) => `${press.string}:${press.fret}`)
        .join('|')
}

/** Forma esperada de um acorde aberto: somente as cordas apertadas. */
function chordShape(chord: Chord): string {
    return STRING_NUMBERS.flatMap((string) => {
        const spec = chord.strings[string]
        return spec.kind === 'fret' ? [`${string}:${spec.fret}`] : []
    }).join('|')
}

/** Reconhece um dos acordes disponíveis somente pela posição corda+casa. */
export function recognizeChord(presses: readonly FingerPress[]): ChordId | null {
    if (presses.length === 0) return null
    const shape = pressShape(presses)
    return CHORDS.find((chord) => chordShape(chord) === shape)?.id ?? null
}

/**
 * Confirma uma forma por permanência e mantém o resultado durante falhas curtas do rastreador.
 * A troca para outro acorde também exige permanência, evitando alternância entre quadros.
 */
export class ChordRecognition {
    private recognized: ChordId | null = null
    private candidate: ChordId | null = null
    private candidateSince = 0
    private missingSince: number | null = null

    constructor(private readonly config: ChordRecognitionConfig = DEFAULT_RECOGNITION_CONFIG) {}

    update(presses: readonly FingerPress[], tMs: number): ChordId | null {
        const detected = recognizeChord(presses)
        if (detected !== null) {
            this.missingSince = null
            if (detected !== this.candidate) {
                this.candidate = detected
                this.candidateSince = tMs
            }
            if (detected !== this.recognized && tMs - this.candidateSince >= this.config.holdMs) {
                this.recognized = detected
            }
            return this.recognized
        }

        this.candidate = null
        if (this.recognized !== null) {
            this.missingSince ??= tMs
            if (tMs - this.missingSince >= this.config.releaseMs) this.recognized = null
        }
        return this.recognized
    }

    reset(): void {
        this.recognized = null
        this.candidate = null
        this.candidateSince = 0
        this.missingSince = null
    }
}
