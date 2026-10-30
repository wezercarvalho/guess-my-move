import { describe, expect, it } from 'vitest'

import { midiToFrequency, synthPluck } from '../src/index.js'

const SAMPLE_RATE = 44100

/** Frequência fundamental por autocorrelação, procurando entre 0,7x e 1,5x da esperada. */
function estimateFrequency(samples: Float32Array, expected: number): number {
    const start = Math.floor(SAMPLE_RATE * 0.05)
    const length = Math.floor(SAMPLE_RATE * 0.25)
    const minLag = Math.floor(SAMPLE_RATE / (expected * 1.5))
    const maxLag = Math.ceil(SAMPLE_RATE / (expected * 0.7))
    let bestLag = minLag
    let best = -Infinity
    for (let lag = minLag; lag <= maxLag; lag++) {
        let sum = 0
        for (let i = 0; i < length; i++) sum += samples[start + i] * samples[start + i + lag]
        if (sum > best) {
            best = sum
            bestLag = lag
        }
    }
    return SAMPLE_RATE / bestLag
}

const energy = (samples: Float32Array, fromSec: number, toSec: number) => {
    let sum = 0
    for (let i = Math.floor(fromSec * SAMPLE_RATE); i < Math.floor(toSec * SAMPLE_RATE); i++) {
        sum += samples[i] * samples[i]
    }
    return sum
}

describe('midiToFrequency', () => {
    it('A4 vale 440 Hz e a corda grave do violão 82,41 Hz', () => {
        expect(midiToFrequency(69)).toBeCloseTo(440, 9)
        expect(midiToFrequency(40)).toBeCloseTo(82.407, 2)
    })
})

describe('synthPluck (Karplus-Strong)', () => {
    it.each([
        ['A2', 45],
        ['E3', 52],
        ['E4', 64],
        ['G4', 67],
    ])('a fundamental de %s fica a no máximo 1%% da frequência esperada', (_name, midi) => {
        const expected = midiToFrequency(midi)
        const samples = synthPluck({ midi, sampleRate: SAMPLE_RATE, seed: 1 })
        const measured = estimateFrequency(samples, expected)
        expect(Math.abs(measured - expected) / expected).toBeLessThan(0.01)
    })

    it('o som decai: a energia depois de 2 s é menos de 10% da inicial', () => {
        const samples = synthPluck({ midi: 45, sampleRate: SAMPLE_RATE, seed: 1 })
        const initial = energy(samples, 0, 0.5)
        const later = energy(samples, 2, 2.5)
        expect(initial).toBeGreaterThan(0)
        expect(later / initial).toBeLessThan(0.1)
    })

    it('a mesma semente e a mesma nota dão buffers idênticos', () => {
        const a = synthPluck({ midi: 50, sampleRate: SAMPLE_RATE, seed: 7 })
        const b = synthPluck({ midi: 50, sampleRate: SAMPLE_RATE, seed: 7 })
        expect(Array.from(a)).toEqual(Array.from(b))
    })

    it('sementes diferentes dão timbres diferentes com a mesma altura', () => {
        const a = synthPluck({ midi: 50, sampleRate: SAMPLE_RATE, seed: 7 })
        const b = synthPluck({ midi: 50, sampleRate: SAMPLE_RATE, seed: 8 })
        expect(Array.from(a)).not.toEqual(Array.from(b))
    })

    it('respeita a duração pedida e não passa de 1 em amplitude', () => {
        const samples = synthPluck({ midi: 45, sampleRate: 22050, durationSec: 1.5, seed: 3 })
        expect(samples.length).toBe(Math.round(22050 * 1.5))
        expect(Math.max(...samples.map(Math.abs))).toBeLessThanOrEqual(1)
    })
})
