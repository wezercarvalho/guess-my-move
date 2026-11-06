import { describe, expect, it, vi } from 'vitest'
import { VideoFrameGate } from './videoFrameGate.js'
function video() {
    const callbacks: Array<() => void> = [],
        cancel = vi.fn()
    return {
        callbacks,
        cancel,
        element: {
            currentTime: 0,
            requestVideoFrameCallback: (callback: () => void) => {
                callbacks.push(callback)
                return callbacks.length
            },
            cancelVideoFrameCallback: cancel,
        } as unknown as HTMLVideoElement,
    }
}
describe('quadros transitórios da câmera', () => {
    it('consome um quadro nativo uma vez e não rearma callback cancelado', () => {
        const frame = vi.fn(),
            source = video(),
            gate = new VideoFrameGate(frame)
        gate.watch(source.element)
        expect(gate.take(source.element, 0)).toBe(false)
        source.callbacks[0]?.()
        expect(gate.take(source.element, 1)).toBe(true)
        expect(gate.take(source.element, 1)).toBe(false)
        expect(frame).toHaveBeenCalledTimes(1)
        const late = source.callbacks.at(-1)
        gate.unwatch()
        const count = source.callbacks.length
        late?.()
        expect(source.callbacks).toHaveLength(count)
        expect(source.cancel).toHaveBeenCalledTimes(1)
    })
    it('mantém fallback por currentTime e contagem sem quadro duplicado', () => {
        const source = { currentTime: 0 } as HTMLVideoElement,
            frame = vi.fn(),
            gate = new VideoFrameGate(frame)
        gate.watch(source)
        expect(gate.take(source, 10)).toBe(true)
        expect(gate.take(source, 11)).toBe(false)
        source.currentTime = 0.1
        expect(gate.take(source, 12)).toBe(true)
        expect(frame).toHaveBeenNthCalledWith(2, 12)
        gate.unwatch()
        expect(gate.take(source, 13)).toBe(true)
    })
})
