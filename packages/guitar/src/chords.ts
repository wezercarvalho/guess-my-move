import {
    type Chord,
    type ChordId,
    type FingerNumber,
    type FretNumber,
    STRING_NUMBERS,
    type StringSpec,
} from './theory.js'

type Slot = 'x' | readonly [FretNumber, FingerNumber] | 0

const m = 'x' as const
const o = 0 as const

/** Monta o acorde a partir da 6ª à 1ª corda: `x` abafada, `0` solta, `[casa, dedo]` apertada. */
function chord(id: ChordId, name: string, label: string, slots: readonly Slot[]): Chord {
    const strings = {} as Record<(typeof STRING_NUMBERS)[number], StringSpec>
    STRING_NUMBERS.forEach((string, index) => {
        const slot = slots[index]
        strings[string] =
            slot === 'x'
                ? { kind: 'muted' }
                : slot === 0
                  ? { kind: 'open' }
                  : { kind: 'fret', fret: slot[0], finger: slot[1] }
    })
    return { id, name, label, strings }
}

/**
 * Os cinco acordes abertos, na ordem de ensino (poucos dedos primeiro; a troca G com C ou D
 * por último). Dedilhado padrão; o G é a forma de três dedos.
 */
export const CHORDS: readonly Chord[] = [
    chord('Em', 'Em', 'Mi menor', [o, [2, 2], [2, 3], o, o, o]),
    chord('Am', 'Am', 'Lá menor', [m, o, [2, 2], [2, 3], [1, 1], o]),
    chord('D', 'D', 'Ré maior', [m, m, o, [2, 1], [3, 3], [2, 2]]),
    chord('C', 'C', 'Dó maior', [m, [3, 3], [2, 2], o, [1, 1], o]),
    chord('G', 'G', 'Sol maior', [[3, 2], [2, 1], o, o, o, [3, 3]]),
]

export const CHORD_IDS: readonly ChordId[] = CHORDS.map((entry) => entry.id)

/** Acorde pelo id; erro claro se o id não existe. */
export function chordById(id: ChordId): Chord {
    const found = CHORDS.find((entry) => entry.id === id)
    if (!found) throw new Error(`Acorde desconhecido: ${String(id)}`)
    return found
}
