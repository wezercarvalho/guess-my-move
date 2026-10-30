/** Cordas numeradas como no violão: a 6 é a mais grave (Mi grave) e a 1 a mais aguda. */
export const STRING_NUMBERS = [6, 5, 4, 3, 2, 1] as const
export type StringNumber = (typeof STRING_NUMBERS)[number]

/** Dedo da mão do braço: 1 indicador, 2 médio, 3 anelar, 4 mindinho. */
export type FingerNumber = 1 | 2 | 3 | 4

/** Casas que a PoC projeta no braço (a casa 0 é a corda solta). */
export type FretNumber = 1 | 2 | 3 | 4 | 5
export const FRET_COUNT = 5

/** Afinação padrão (E2 A2 D3 G3 B3 E4) em números MIDI, por corda. */
export const OPEN_STRING_MIDI: Readonly<Record<StringNumber, number>> = {
    6: 40,
    5: 45,
    4: 50,
    3: 55,
    2: 59,
    1: 64,
}

/** O que o acorde pede de uma corda: abafada, solta ou apertada numa casa por um dedo. */
export type StringSpec =
    | { readonly kind: 'muted' }
    | { readonly kind: 'open' }
    | { readonly kind: 'fret'; readonly fret: FretNumber; readonly finger: FingerNumber }

export type ChordId = 'Em' | 'Am' | 'D' | 'C' | 'G'

export interface Chord {
    readonly id: ChordId
    /** Nome curto, como no diagrama. */
    readonly name: string
    /** Nome por extenso, em português. */
    readonly label: string
    readonly strings: Readonly<Record<StringNumber, StringSpec>>
}

/** Uma corda que soa: a casa (0 = solta) e a nota MIDI resultante. */
export interface SoundingString {
    readonly string: StringNumber
    readonly fret: number
    readonly midi: number
}

const PITCH_CLASS_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

/** Nota MIDI de uma corda numa casa (0 = solta). */
export function midiOf(string: StringNumber, fret: number): number {
    return OPEN_STRING_MIDI[string] + fret
}

/** Nome da classe de altura (sustenidos), sem a oitava. */
export function pitchClassName(midi: number): string {
    return PITCH_CLASS_NAMES[((midi % 12) + 12) % 12]
}

/** Cordas que o acorde alvo toca, da 6 à 1, com a casa pedida e a nota. Abafadas ficam de fora. */
export function soundingStrings(chord: Chord): SoundingString[] {
    const result: SoundingString[] = []
    for (const string of STRING_NUMBERS) {
        const spec = chord.strings[string]
        if (spec.kind === 'muted') continue
        const fret = spec.kind === 'open' ? 0 : spec.fret
        result.push({ string, fret, midi: midiOf(string, fret) })
    }
    return result
}
