import { describe, expect, it } from 'vitest'

import { type FingerPress, chordById, evaluateChord, planStrum } from '../src/index.js'

const EM_PRESSES: FingerPress[] = [
    { finger: 2, string: 5, fret: 2 },
    { finger: 3, string: 4, fret: 2 },
]

const emSounding = evaluateChord(chordById('Em'), EM_PRESSES).sounding

describe('planStrum', () => {
    it('para baixo, toca da corda 6 à 1 com atraso crescente', () => {
        const plan = planStrum(emSounding, 'down', 0.8)
        expect(plan.map((note) => note.string)).toEqual([6, 5, 4, 3, 2, 1])
        const delays = plan.map((note) => note.delayMs)
        expect(delays[0]).toBe(0)
        for (let i = 1; i < delays.length; i++) expect(delays[i]).toBeGreaterThan(delays[i - 1])
    })

    it('para cima, a ordem é a inversa', () => {
        const plan = planStrum(emSounding, 'up', 0.8)
        expect(plan.map((note) => note.string)).toEqual([1, 2, 3, 4, 5, 6])
        expect(plan[0].delayMs).toBe(0)
    })

    it('mais força dá mais ganho, sempre entre 0 e 1', () => {
        const soft = planStrum(emSounding, 'down', 0.2)
        const hard = planStrum(emSounding, 'down', 1)
        expect(hard[0].gain).toBeGreaterThan(soft[0].gain)
        for (const note of [...soft, ...hard]) {
            expect(note.gain).toBeGreaterThan(0)
            expect(note.gain).toBeLessThanOrEqual(1)
        }
    })

    it('o D tem as cordas 6 e 5 abafadas: só quatro notas', () => {
        const d = evaluateChord(chordById('D'), [
            { finger: 1, string: 3, fret: 2 },
            { finger: 3, string: 2, fret: 3 },
            { finger: 2, string: 1, fret: 2 },
        ])
        expect(planStrum(d.sounding, 'down', 0.5)).toHaveLength(4)
    })

    it('um formato errado muda a nota daquela corda', () => {
        const right = planStrum(emSounding, 'down', 0.5)
        const wrong = planStrum(
            evaluateChord(chordById('Em'), [
                { finger: 2, string: 5, fret: 3 },
                { finger: 3, string: 4, fret: 2 },
            ]).sounding,
            'down',
            0.5,
        )
        const note = (plan: typeof right, string: number) => plan.find((n) => n.string === string)!.midi
        expect(note(right, 5)).toBe(47)
        expect(note(wrong, 5)).toBe(48)
        expect(note(wrong, 4)).toBe(note(right, 4))
    })

    it('sem cordas não há notas', () => {
        expect(planStrum([], 'down', 1)).toEqual([])
    })

    it('o atraso entre cordas é configurável', () => {
        const plan = planStrum(emSounding, 'down', 0.5, { stringDelayMs: 30, minGain: 0.3, maxGain: 1 })
        expect(plan[1].delayMs).toBe(30)
    })
})
