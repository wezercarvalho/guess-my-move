import { type PlannedNote, synthPluck } from '@guess-my-move/guitar'

/** Parte do `AudioBuffer` usada aqui. */
export interface AudioBufferLike {
    copyToChannel(source: Float32Array<ArrayBuffer>, channelNumber: number): void
}

export interface AudioBufferSourceLike {
    buffer: AudioBufferLike | null
    connect(destination: unknown): unknown
    start(when?: number): void
}

export interface GainNodeLike {
    readonly gain: { value: number }
    connect(destination: unknown): unknown
}

/**
 * Parte do `AudioContext` usada aqui; permite simular o áudio nos testes. O contexto real
 * satisfaz esta forma.
 */
export interface AudioContextLike {
    readonly state: string
    readonly currentTime: number
    readonly sampleRate: number
    readonly baseLatency?: number
    readonly outputLatency?: number
    readonly destination: unknown
    resume(): Promise<void>
    close(): Promise<void>
    createBuffer(numberOfChannels: number, length: number, sampleRate: number): AudioBufferLike
    createBufferSource(): AudioBufferSourceLike
    createGain(): GainNodeLike
}

/**
 * `idle`: nenhum gesto ainda (o navegador só libera o áudio depois de um clique ou tecla);
 * `locked`: o contexto existe, mas está suspenso; `running`: toca; `unavailable`: sem áudio.
 */
export type AudioStatus = 'idle' | 'locked' | 'running' | 'unavailable'

export interface AudioPlayer {
    readonly status: AudioStatus
    /** Cria ou retoma o contexto. Chame dentro de um gesto do usuário (clique ou tecla). */
    unlock(): Promise<void>
    /** Agenda as notas; devolve `false` (sem tocar) se o áudio não está rodando. */
    play(plan: readonly PlannedNote[]): boolean
    latency(): { base: number | null; output: number | null }
    subscribe(listener: () => void): () => void
    dispose(): void
}

/** Ganho geral: seis cordas somadas não podem estourar (hipótese a calibrar de ouvido). */
export const MASTER_GAIN = 0.35

/** Contexto real do navegador, com latência interativa; `null` onde não há Web Audio. */
export function defaultAudioContext(): AudioContextLike | null {
    if (typeof AudioContext === 'undefined') return null
    return new AudioContext({ latencyHint: 'interactive' })
}

/**
 * Tocador de corda sintetizada. Um único `AudioContext`, criado ou retomado dentro de um
 * gesto do usuário, e um buffer por nota, sintetizado na primeira vez (Karplus-Strong) e
 * reaproveitado depois. Nenhum arquivo de áudio.
 */
export function createAudioPlayer(
    createContext: () => AudioContextLike | null = defaultAudioContext,
): AudioPlayer {
    let context: AudioContextLike | null = null
    let status: AudioStatus = 'idle'
    const listeners = new Set<() => void>()
    const cache = new Map<number, AudioBufferLike>()

    const setStatus = (next: AudioStatus) => {
        if (status === next) return
        status = next
        for (const listener of listeners) listener()
    }

    const bufferFor = (ctx: AudioContextLike, midi: number): AudioBufferLike => {
        const cached = cache.get(midi)
        if (cached) return cached
        const data = synthPluck({ midi, sampleRate: ctx.sampleRate, seed: midi })
        const buffer = ctx.createBuffer(1, data.length, ctx.sampleRate)
        buffer.copyToChannel(data, 0)
        cache.set(midi, buffer)
        return buffer
    }

    return {
        get status() {
            return status
        },
        async unlock() {
            if (status === 'unavailable') return
            if (!context) {
                try {
                    context = createContext()
                } catch {
                    context = null
                }
                if (!context) {
                    setStatus('unavailable')
                    return
                }
            }
            if (context.state !== 'running') {
                try {
                    await context.resume()
                } catch {
                    // o navegador recusou: o próximo gesto tenta de novo
                }
            }
            setStatus(context.state === 'running' ? 'running' : 'locked')
        },
        play(plan) {
            const ctx = context
            if (!ctx) return false
            if (ctx.state !== 'running') {
                setStatus('locked')
                return false
            }
            const now = ctx.currentTime
            for (const note of plan) {
                const source = ctx.createBufferSource()
                source.buffer = bufferFor(ctx, note.midi)
                const gain = ctx.createGain()
                gain.gain.value = note.gain * MASTER_GAIN
                source.connect(gain)
                gain.connect(ctx.destination)
                source.start(now + note.delayMs / 1000)
            }
            return true
        },
        latency() {
            return { base: context?.baseLatency ?? null, output: context?.outputLatency ?? null }
        },
        subscribe(listener) {
            listeners.add(listener)
            return () => {
                listeners.delete(listener)
            }
        },
        dispose() {
            listeners.clear()
            const ctx = context
            context = null
            cache.clear()
            if (ctx) void ctx.close().catch(() => undefined)
        },
    }
}
