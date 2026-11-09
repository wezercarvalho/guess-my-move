import { describe, expect, it } from 'vitest'

import {
    CHORDS,
    CHORD_IDS,
    OPEN_STRING_MIDI,
    STRING_NUMBERS,
    chordById,
    pitchClassName,
    soundingStrings,
} from '../src/index.js'

/** Tríade de cada acorde, como conjunto de classes de altura. */
const TRIAD: Record<string, readonly string[]> = {
    Em: ['E', 'G', 'B'],
    Am: ['A', 'C', 'E'],
    D: ['D', 'F#', 'A'],
    C: ['C', 'E', 'G'],
    G: ['G', 'B', 'D'],
}

describe('afinação e acordes', () => {
    it('a afinação padrão vai de E2 a E4 (MIDI 40 45 50 55 59 64)', () => {
        expect(STRING_NUMBERS.map((string) => OPEN_STRING_MIDI[string])).toEqual([
            40, 45, 50, 55, 59, 64,
        ])
    })

    it('os cinco acordes seguem a ordem de ensino Em, Am, D, C, G', () => {
        expect(CHORD_IDS).toEqual(['Em', 'Am', 'D', 'C', 'G'])
        expect(CHORDS.map((chord) => chord.id)).toEqual(CHORD_IDS)
    })

    it.each(CHORD_IDS)('as classes de altura soantes do %s são exatamente as da tríade', (id) => {
        const classes = new Set(
            soundingStrings(chordById(id)).map((note) => pitchClassName(note.midi)),
        )
        expect([...classes].sort()).toEqual([...TRIAD[id]].sort())
    })

    it('o Em tem as cordas 5 e 4 na casa 2 (dedos 2 e 3) e as demais soltas', () => {
        const em = chordById('Em')
        expect(em.strings[5]).toEqual({ kind: 'fret', fret: 2, finger: 2 })
        expect(em.strings[4]).toEqual({ kind: 'fret', fret: 2, finger: 3 })
        for (const string of [6, 3, 2, 1] as const) expect(em.strings[string]).toEqual({ kind: 'open' })
    })

    it('Am, C e D têm cordas abafadas que não geram nota', () => {
        expect(chordById('Am').strings[6]).toEqual({ kind: 'muted' })
        expect(chordById('C').strings[6]).toEqual({ kind: 'muted' })
        expect(chordById('D').strings[6]).toEqual({ kind: 'muted' })
        expect(chordById('D').strings[5]).toEqual({ kind: 'muted' })
        expect(soundingStrings(chordById('D'))).toHaveLength(4)
        expect(soundingStrings(chordById('Am'))).toHaveLength(5)
    })

    it('registra o dedilhado padrão dos outros quatro acordes', () => {
        const fretted = (id: 'Am' | 'D' | 'C' | 'G') =>
            STRING_NUMBERS.map((string) => {
                const spec = chordById(id).strings[string]
                return spec.kind === 'fret' ? `${spec.fret}:${spec.finger}` : spec.kind[0]
            }).join(' ')
        expect(fretted('Am')).toBe('m o 2:2 2:3 1:1 o')
        expect(fretted('D')).toBe('m m o 2:1 3:3 2:2')
        expect(fretted('C')).toBe('m 3:3 2:2 o 1:1 o')
        expect(fretted('G')).toBe('3:2 2:1 o o o 3:3')
    })

    it('chordById recusa um id que não existe', () => {
        expect(() => chordById('Xyz' as never)).toThrow(/acorde/i)
    })
})
