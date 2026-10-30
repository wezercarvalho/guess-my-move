export interface PluckOptions {
    /** Nota MIDI da corda tocada. */
    readonly midi: number
    readonly sampleRate: number
    /** Duração do buffer em segundos (padrão 3). */
    readonly durationSec?: number
    /** Semente do ruído inicial: a mesma semente dá o mesmo som. */
    readonly seed?: number
    /** Tempo para a corda cair 60 dB, em segundos (padrão 2,5; hipótese a calibrar de ouvido). */
    readonly decaySeconds?: number
    /** De 0 a 1: mais alto deixa o som mais brilhante, menos filtrado (padrão 0,5, a média clássica). */
    readonly brightness?: number
}

/** Frequência em Hz de uma nota MIDI (A4 = 69 = 440 Hz). */
export function midiToFrequency(midi: number): number {
    return 440 * 2 ** ((midi - 69) / 12)
}

/** Gerador pseudoaleatório determinístico (mulberry32), com valores de -1 a 1. */
function randomStream(seed: number): () => number {
    let state = seed >>> 0
    return () => {
        state = (state + 0x6d2b79f5) >>> 0
        let t = state
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1
    }
}

/**
 * Nota de corda dedilhada pelo algoritmo Karplus-Strong (Karplus e Strong, 1983): uma rajada
 * de ruído numa linha de atraso de N ≈ fs/f0 amostras, realimentada por uma média ponderada
 * de duas amostras vizinhas e por um ganho que fixa o tempo de decaimento. Determinístico:
 * o ruído vem de uma semente. Devolve amostras de -1 a 1 sem tocar em `AudioContext`.
 */
export function synthPluck(options: PluckOptions): Float32Array<ArrayBuffer> {
    const { midi, sampleRate } = options
    const durationSec = options.durationSec ?? 3
    const decaySeconds = options.decaySeconds ?? 2.5
    const brightness = Math.min(1, Math.max(0, options.brightness ?? 0.5))
    const frequency = midiToFrequency(midi)
    // a média de duas amostras atrasa meia amostra; compensa para afinar
    const period = Math.max(2, Math.round(sampleRate / frequency - 0.5))
    // ganho por volta da linha de atraso: cai 60 dB (fator 0,001) em decaySeconds
    const loopGain = 0.001 ** (1 / (frequency * decaySeconds))

    const next = randomStream(options.seed ?? 1)
    const ring = new Float32Array(period)
    for (let i = 0; i < period; i++) ring[i] = next() * 0.8

    const total = Math.round(sampleRate * durationSec)
    const out = new Float32Array(total)
    let index = 0
    let previous = ring[period - 1]
    for (let n = 0; n < total; n++) {
        const current = ring[index]
        out[n] = current
        ring[index] = loopGain * (brightness * current + (1 - brightness) * previous)
        previous = current
        index = (index + 1) % period
    }
    return out
}
