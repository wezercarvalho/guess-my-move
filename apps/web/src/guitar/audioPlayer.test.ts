import { describe, expect, it, vi } from 'vitest'

import { type AudioContextLike, createAudioPlayer } from './audioPlayer.js'

interface FakeSource {
    buffer: unknown
    connect: ReturnType<typeof vi.fn<(destination: unknown) => void>>
    start: ReturnType<typeof vi.fn<(when?: number) => void>>
}

interface FakeGain {
    gain: { value: number }
    connect: ReturnType<typeof vi.fn<(destination: unknown) => void>>
}

/** `AudioContext` simulado: nada de áudio real. */
function fakeContext(initialState: 'suspended' | 'running' = 'suspended') {
    const sources: FakeSource[] = []
    const gains: FakeGain[] = []
    const buffers: { length: number; sampleRate: number; data: Float32Array | null }[] = []
    const context = {
        state: initialState as string,
        currentTime: 10,
        sampleRate: 22050,
        baseLatency: 0.01,
        outputLatency: 0.04,
        destination: { name: 'destino' },
        resume: vi.fn(() => {
            context.state = 'running'
            return Promise.resolve()
        }),
        close: vi.fn(() => Promise.resolve()),
        createBuffer: vi.fn((_channels: number, length: number, sampleRate: number) => {
            const entry = { length, sampleRate, data: null as Float32Array | null }
            buffers.push(entry)
            return {
                length,
                copyToChannel: (data: Float32Array) => {
                    entry.data = data
                },
            }
        }),
        createBufferSource: vi.fn(() => {
            const source: FakeSource = {
                buffer: null,
                connect: vi.fn<(destination: unknown) => void>(),
                start: vi.fn<(when?: number) => void>(),
            }
            sources.push(source)
            return source
        }),
        createGain: vi.fn(() => {
            const gain: FakeGain = { gain: { value: 1 }, connect: vi.fn<(destination: unknown) => void>() }
            gains.push(gain)
            return gain
        }),
    }
    return { context: context as unknown as AudioContextLike & typeof context, sources, gains, buffers }
}

const plan = [
    { string: 6 as const, midi: 40, delayMs: 0, gain: 0.8 },
    { string: 5 as const, midi: 47, delayMs: 18, gain: 0.8 },
    { string: 4 as const, midi: 52, delayMs: 36, gain: 0.8 },
]

describe('createAudioPlayer', () => {
    it('começa ocioso e não toca antes de um gesto do usuário', () => {
        const { context, sources } = fakeContext()
        const factory = vi.fn(() => context)
        const player = createAudioPlayer(factory)
        expect(player.status).toBe('idle')
        expect(player.play(plan)).toBe(false)
        expect(factory).not.toHaveBeenCalled()
        expect(sources).toHaveLength(0)
    })

    it('unlock cria um único contexto, retoma e passa a rodando', async () => {
        const { context } = fakeContext('suspended')
        const factory = vi.fn(() => context)
        const player = createAudioPlayer(factory)
        await player.unlock()
        await player.unlock()
        expect(factory).toHaveBeenCalledTimes(1)
        expect(context.resume).toHaveBeenCalled()
        expect(player.status).toBe('running')
    })

    it('depois de desbloqueado, agenda cada corda no tempo do contexto mais o atraso', async () => {
        const { context, sources, gains } = fakeContext('running')
        const player = createAudioPlayer(() => context)
        await player.unlock()
        expect(player.play(plan)).toBe(true)
        expect(sources).toHaveLength(3)
        expect(sources.map((source) => source.start.mock.calls[0]?.[0])).toEqual([10, 10.018, 10.036])
        // o ganho de cada nota segue o plano, com folga na soma das seis cordas
        for (const gain of gains) {
            expect(gain.gain.value).toBeGreaterThan(0)
            expect(gain.gain.value).toBeLessThan(0.8)
            expect(gain.connect).toHaveBeenCalledWith(context.destination)
        }
        for (const source of sources) expect(source.connect).toHaveBeenCalled()
    })

    it('sintetiza cada nota uma vez e reaproveita o buffer nas batidas seguintes', async () => {
        const { context, buffers } = fakeContext('running')
        const player = createAudioPlayer(() => context)
        await player.unlock()
        player.play(plan)
        player.play(plan)
        expect(buffers).toHaveLength(3)
        expect(buffers[0]?.sampleRate).toBe(22050)
        expect(buffers[0]?.data).toBeInstanceOf(Float32Array)
    })

    it('se o navegador suspende o contexto depois, não toca e volta a bloqueado', async () => {
        const { context, sources } = fakeContext('running')
        const player = createAudioPlayer(() => context)
        await player.unlock()
        context.state = 'suspended'
        expect(player.play(plan)).toBe(false)
        expect(player.status).toBe('locked')
        expect(sources).toHaveLength(0)
    })

    it('se retomar falha, o estado é bloqueado e o próximo gesto tenta de novo', async () => {
        const { context } = fakeContext('suspended')
        context.resume.mockRejectedValueOnce(new Error('bloqueado'))
        const player = createAudioPlayer(() => context)
        await player.unlock()
        expect(player.status).toBe('locked')
        await player.unlock()
        expect(player.status).toBe('running')
    })

    it('sem suporte a áudio, o estado é indisponível e nada quebra', async () => {
        const player = createAudioPlayer(() => null)
        await player.unlock()
        expect(player.status).toBe('unavailable')
        expect(player.play(plan)).toBe(false)
    })

    it('se criar o contexto lança erro, o estado é indisponível', async () => {
        const player = createAudioPlayer(() => {
            throw new Error('sem áudio')
        })
        await player.unlock()
        expect(player.status).toBe('unavailable')
    })

    it('expõe a latência do contexto para a depuração', async () => {
        const { context } = fakeContext('running')
        const player = createAudioPlayer(() => context)
        expect(player.latency()).toEqual({ base: null, output: null })
        await player.unlock()
        expect(player.latency()).toEqual({ base: 0.01, output: 0.04 })
    })

    it('avisa quem assina quando o estado muda e para de avisar ao cancelar', async () => {
        const { context } = fakeContext('suspended')
        const player = createAudioPlayer(() => context)
        const listener = vi.fn()
        const unsubscribe = player.subscribe(listener)
        await player.unlock()
        expect(listener).toHaveBeenCalled()
        const calls = listener.mock.calls.length
        unsubscribe()
        player.dispose()
        expect(listener.mock.calls.length).toBe(calls)
    })

    it('dispose fecha o contexto', async () => {
        const { context } = fakeContext('running')
        const player = createAudioPlayer(() => context)
        await player.unlock()
        player.dispose()
        expect(context.close).toHaveBeenCalled()
    })
})
