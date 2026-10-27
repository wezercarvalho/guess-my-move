import { describe, expect, it } from 'vitest'

import {
    acenarCard,
    createRound,
    DEFAULT_MAX_DURATION_MS,
    type OscillationVerdict,
} from '../src/index.js'

function setup(maxDurationMs?: number) {
    let now = 1000
    const clock = () => now
    const round = createRound({
        card: acenarCard,
        clock,
        ...(maxDurationMs === undefined ? {} : { maxDurationMs }),
    })
    return {
        round,
        advance: (ms: number) => {
            now += ms
        },
    }
}

/** Alimenta oscilações largas (±30°) a cada 100 ms até reconhecer ou esgotar `count`. */
function wave(ctx: ReturnType<typeof setup>, count: number): OscillationVerdict | null {
    let last: OscillationVerdict | null = null
    for (let i = 0; i < count; i++) {
        ctx.advance(100)
        const phase = (i % 8) / 8
        const tri = phase < 0.5 ? phase * 2 : 2 - phase * 2
        last = ctx.round.observe(-30 + 60 * tri)
        if (ctx.round.state !== 'detecting') break
    }
    return last
}

describe('rodada — fluxo feliz', () => {
    it('percorre idle → card_revealed → camera_ready → detecting → recognized', () => {
        const ctx = setup()
        expect(ctx.round.state).toBe('idle')
        ctx.round.revealCard()
        expect(ctx.round.state).toBe('card_revealed')
        ctx.round.cameraReady()
        expect(ctx.round.state).toBe('camera_ready')
        ctx.round.start()
        expect(ctx.round.state).toBe('detecting')

        const verdict = wave(ctx, 40)
        expect(verdict?.recognized).toBe(true)
        expect(ctx.round.state).toBe('recognized')
        expect(ctx.round.finished).toBe(true)
        expect(ctx.round.verdict?.reversals).toBeGreaterThanOrEqual(3)
    })

    it('reconhece no primeiro instante em que o avaliador devolve reconhecido', () => {
        const ctx = setup()
        ctx.round.revealCard()
        ctx.round.cameraReady()
        ctx.round.start()
        wave(ctx, 40)
        const stoppedAt = ctx.round.elapsedMs
        expect(ctx.round.state).toBe('recognized')
        // Amostras posteriores são ignoradas e o estado não muda.
        ctx.advance(500)
        expect(ctx.round.observe(0)).toBeNull()
        expect(ctx.round.elapsedMs).toBe(stoppedAt)
    })

    it('mede o tempo decorrido desde o Começar', () => {
        const ctx = setup()
        expect(ctx.round.elapsedMs).toBeNull()
        ctx.round.revealCard()
        ctx.round.cameraReady()
        ctx.round.start()
        ctx.advance(300)
        expect(ctx.round.elapsedMs).toBe(300)
    })
})

describe('rodada — limite de tempo', () => {
    it('usa 10 s por padrão', () => {
        expect(DEFAULT_MAX_DURATION_MS).toBe(10_000)
    })

    it('termina em timed_out por tick quando o limite passa sem reconhecimento', () => {
        const ctx = setup()
        ctx.round.revealCard()
        ctx.round.cameraReady()
        ctx.round.start()
        ctx.advance(9_999)
        ctx.round.tick()
        expect(ctx.round.state).toBe('detecting')
        ctx.advance(1)
        ctx.round.tick()
        expect(ctx.round.state).toBe('timed_out')
        expect(ctx.round.finished).toBe(true)
    })

    it('termina em timed_out ao observar depois do limite, sem reconhecer', () => {
        const ctx = setup(2_000)
        ctx.round.revealCard()
        ctx.round.cameraReady()
        ctx.round.start()
        ctx.advance(2_500)
        expect(ctx.round.observe(30)).toBeNull()
        expect(ctx.round.state).toBe('timed_out')
    })

    it('respeita um limite configurado', () => {
        const ctx = setup(1_000)
        ctx.round.revealCard()
        ctx.round.cameraReady()
        ctx.round.start()
        ctx.advance(1_000)
        ctx.round.tick()
        expect(ctx.round.state).toBe('timed_out')
    })

    it('rejeita limite não positivo', () => {
        expect(() => createRound({ card: acenarCard, maxDurationMs: 0 })).toThrow()
    })
})

describe('rodada — exceções', () => {
    it('câmera negada encerra a rodada e impede o início', () => {
        const ctx = setup()
        ctx.round.revealCard()
        ctx.round.denyCamera()
        expect(ctx.round.state).toBe('camera_denied')
        expect(ctx.round.finished).toBe(true)
        expect(() => ctx.round.start()).toThrow()
    })

    it('falha do detector encerra a rodada com o motivo', () => {
        const ctx = setup()
        ctx.round.revealCard()
        ctx.round.cameraReady()
        ctx.round.trackerFailed('modelo não carregou')
        expect(ctx.round.state).toBe('tracker_error')
        expect(ctx.round.finished).toBe(true)
        expect(ctx.round.failureReason).toBe('modelo não carregou')
    })

    it('falha do detector durante a detecção não marca reconhecimento', () => {
        const ctx = setup()
        ctx.round.revealCard()
        ctx.round.cameraReady()
        ctx.round.start()
        ctx.advance(100)
        ctx.round.observe(-30)
        ctx.round.trackerFailed('erro de inferência')
        expect(ctx.round.state).toBe('tracker_error')
        expect(ctx.round.observe(30)).toBeNull()
    })

    it('cancelar encerra a rodada em qualquer estado não final', () => {
        const ctx = setup()
        ctx.round.revealCard()
        ctx.round.cameraReady()
        ctx.round.start()
        ctx.round.cancel()
        expect(ctx.round.state).toBe('user_cancelled')
        expect(ctx.round.finished).toBe(true)
    })

    it('cancelar depois de terminar não muda o desfecho', () => {
        const ctx = setup()
        ctx.round.revealCard()
        ctx.round.cameraReady()
        ctx.round.start()
        wave(ctx, 40)
        ctx.round.cancel()
        expect(ctx.round.state).toBe('recognized')
    })
})

describe('rodada — transições inválidas e amostras', () => {
    it('lança em transição fora de ordem', () => {
        const ctx = setup()
        expect(() => ctx.round.cameraReady()).toThrow()
        expect(() => ctx.round.start()).toThrow()
        ctx.round.revealCard()
        expect(() => ctx.round.revealCard()).toThrow()
        expect(() => ctx.round.start()).toThrow()
    })

    it('ignora amostras fora do estado detecting', () => {
        const ctx = setup()
        expect(ctx.round.observe(10)).toBeNull()
        ctx.round.revealCard()
        ctx.round.cameraReady()
        expect(ctx.round.observe(10)).toBeNull()
        expect(ctx.round.verdict).toBeNull()
    })

    it('não acumula amostras fora da janela', () => {
        const ctx = setup(60_000)
        ctx.round.revealCard()
        ctx.round.cameraReady()
        ctx.round.start()
        for (let i = 0; i < 200; i++) {
            ctx.advance(100)
            ctx.round.observe(0)
        }
        expect(ctx.round.verdict?.windowSamples).toBeLessThanOrEqual(25)
        expect(ctx.round.state).toBe('detecting')
    })

    it('não reconhece movimento pequeno ou sem volta', () => {
        const ctx = setup(60_000)
        ctx.round.revealCard()
        ctx.round.cameraReady()
        ctx.round.start()
        for (let i = 0; i < 100; i++) {
            ctx.advance(100)
            ctx.round.observe(i % 2 === 0 ? 3 : -3)
        }
        expect(ctx.round.state).toBe('detecting')
        expect(ctx.round.verdict?.reversals).toBe(0)
    })
})
