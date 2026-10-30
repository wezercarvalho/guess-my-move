import { describe, expect, it } from 'vitest'

import { type Rect, type StrumEvent, StrumDetector, type StrumSample } from '../src/index.js'

const ZONE: Rect = { x0: 0.65, x1: 1, y0: 0.1, y1: 0.9 }
const DT = 33

/** Curva suave de 0 a 1 (3s² − 2s³). */
const smooth = (s: number) => {
    const c = Math.min(1, Math.max(0, s))
    return 3 * c * c - 2 * c * c * c
}

interface StrokeOptions {
    from: number
    to: number
    /** Quadros do movimento. */
    frames: number
    /** Quadros parados antes e depois. */
    before?: number
    after?: number
    x?: number
    handSize?: number
}

/** Amostras de um golpe com perfil suave, num relógio que começa em `start`. */
function stroke(start: number, options: StrokeOptions): StrumSample[] {
    const { from, to, frames, before = 4, after = 4, x = 0.8, handSize = 0.15 } = options
    const samples: StrumSample[] = []
    let t = start
    for (let i = 0; i < before; i++) samples.push({ tMs: (t += DT), x, y: from, handSize })
    for (let i = 1; i <= frames; i++) {
        samples.push({ tMs: (t += DT), x, y: from + (to - from) * smooth(i / frames), handSize })
    }
    for (let i = 0; i < after; i++) samples.push({ tMs: (t += DT), x, y: to, handSize })
    return samples
}

function run(samples: readonly StrumSample[], detector = new StrumDetector()): StrumEvent[] {
    const events: StrumEvent[] = []
    for (const sample of samples) {
        const event = detector.update(sample, ZONE)
        if (event) events.push(event)
    }
    return events
}

describe('StrumDetector', () => {
    it('uma descida rápida na zona dá um evento para baixo', () => {
        const events = run(stroke(0, { from: 0.35, to: 0.6, frames: 6 }))
        expect(events).toHaveLength(1)
        expect(events[0].direction).toBe('down')
        expect(events[0].force).toBeGreaterThan(0.2)
    })

    it('uma subida rápida dá um evento para cima', () => {
        const events = run(stroke(0, { from: 0.6, to: 0.35, frames: 6 }))
        expect(events).toHaveLength(1)
        expect(events[0].direction).toBe('up')
    })

    it('a força cresce com a velocidade do golpe', () => {
        const slow = run(stroke(0, { from: 0.4, to: 0.55, frames: 7 }))
        const fast = run(stroke(0, { from: 0.3, to: 0.7, frames: 5 }))
        expect(slow).toHaveLength(1)
        expect(fast).toHaveLength(1)
        expect(fast[0].force).toBeGreaterThan(slow[0].force)
        expect(fast[0].force).toBeLessThanOrEqual(1)
        expect(slow[0].force).toBeGreaterThan(0)
    })

    it('a mesma trajetória com a mão em tamanho 2x dá o mesmo resultado', () => {
        const normal = run(stroke(0, { from: 0.35, to: 0.55, frames: 6, handSize: 0.1 }))
        const bigger = run(stroke(0, { from: 0.35 * 2 - 0.35, to: 0.35 + 0.2 * 2, frames: 6, handSize: 0.2 }))
        expect(normal).toHaveLength(1)
        expect(bigger).toHaveLength(1)
        expect(bigger[0].direction).toBe(normal[0].direction)
        expect(bigger[0].force).toBeCloseTo(normal[0].force, 3)
    })

    it('um movimento abaixo do limiar não dispara', () => {
        const events = run(stroke(0, { from: 0.45, to: 0.5, frames: 12 }))
        expect(events).toEqual([])
    })

    it('fora da zona de batida não dispara', () => {
        const events = run(stroke(0, { from: 0.35, to: 0.6, frames: 6, x: 0.3 }))
        expect(events).toEqual([])
    })

    it('descida rápida seguida de recuperação lenta dá um único evento', () => {
        const down = stroke(0, { from: 0.35, to: 0.65, frames: 6, after: 0 })
        const lastT = down[down.length - 1].tMs
        // 40 quadros (1,3 s) para subir 0,30: pico de ~2,3 tamanhos de mão por segundo,
        // abaixo do limiar de 3 (uma subida mais viva seria uma batida para cima de verdade)
        const recover = stroke(lastT, { from: 0.65, to: 0.35, frames: 40, before: 0, after: 6 })
        expect(run([...down, ...recover])).toHaveLength(1)
    })

    it('uma subida de recuperação acima do limiar conta como batida para cima', () => {
        const down = stroke(0, { from: 0.35, to: 0.65, frames: 6, after: 0 })
        const lastT = down[down.length - 1].tMs
        const recover = stroke(lastT, { from: 0.65, to: 0.35, frames: 24, before: 0, after: 6 })
        expect(run([...down, ...recover]).map((event) => event.direction)).toEqual(['down', 'up'])
    })

    it('duas batidas separadas por menos que o refratário: só a primeira dispara', () => {
        const down = stroke(0, { from: 0.35, to: 0.6, frames: 3, before: 4, after: 0 })
        const up = stroke(down[down.length - 1].tMs, { from: 0.6, to: 0.35, frames: 3, before: 0, after: 4 })
        const events = run([...down, ...up])
        expect(events).toHaveLength(1)
        expect(events[0].direction).toBe('down')
    })

    it('uma descida e, depois do refratário, uma subida disparam as duas', () => {
        const down = stroke(0, { from: 0.35, to: 0.6, frames: 5, before: 4, after: 6 })
        const up = stroke(down[down.length - 1].tMs, { from: 0.6, to: 0.35, frames: 5, before: 0, after: 4 })
        expect(run([...down, ...up]).map((event) => event.direction)).toEqual(['down', 'up'])
    })

    it('o salto de posição ao reencontrar a mão não vira batida', () => {
        const before = stroke(0, { from: 0.3, to: 0.3, frames: 1, before: 6, after: 0 })
        const lastT = before[before.length - 1].tMs
        // a mão some por 600 ms e volta bem mais abaixo, parada
        const after = stroke(lastT + 600, { from: 0.75, to: 0.75, frames: 1, before: 8, after: 0 })
        expect(run([...before, ...after])).toEqual([])
    })

    it('lost() reinicia: o primeiro quadro depois não gera evento', () => {
        const detector = new StrumDetector()
        run(stroke(0, { from: 0.3, to: 0.3, frames: 1, before: 6, after: 0 }), detector)
        detector.lost()
        const after = stroke(2000, { from: 0.75, to: 0.75, frames: 1, before: 8, after: 0 })
        expect(run(after, detector)).toEqual([])
    })

    it('a mesma entrada dá a mesma saída', () => {
        const samples = stroke(0, { from: 0.35, to: 0.6, frames: 6 })
        expect(run(samples)).toEqual(run(samples))
    })

    it('expõe a velocidade assinada para a depuração', () => {
        const detector = new StrumDetector()
        run(stroke(0, { from: 0.35, to: 0.6, frames: 6, after: 0 }), detector)
        expect(detector.debug().speed).toBeGreaterThan(0)
    })
})
