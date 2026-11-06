import { describe, expect, it, vi } from 'vitest'
import { AsyncTrackerResource } from './asyncTrackerResource.js'

describe('posse de detector assíncrono', () => {
    it('fecha carga cancelada sem substituir uma instância posterior', async () => {
        let resolve: ((value: { close: () => void }) => void) | undefined
        const first = { close: vi.fn() },
            second = { close: vi.fn() },
            ready = vi.fn(),
            resource = new AsyncTrackerResource<{ close: () => void }>()
        resource.load(
            () =>
                new Promise((done) => {
                    resolve = done
                }),
            { onReady: ready },
        )
        expect(resource.status).toBe('loading')
        resource.release()
        resource.load(() => Promise.resolve(second))
        await Promise.resolve()
        resolve?.(first)
        await Promise.resolve()
        expect(resource.value).toBe(second)
        expect(first.close).toHaveBeenCalledTimes(1)
        expect(ready).not.toHaveBeenCalled()
        resource.release()
        resource.release()
        expect(second.close).toHaveBeenCalledTimes(1)
        expect(resource.status).toBe('idle')
    })
    it('registra falha e permite reabertura, inclusive factory que lança sincronamente', async () => {
        const resource = new AsyncTrackerResource<{ close: () => void }>(),
            error = vi.fn(),
            tracker = { close: vi.fn() }
        resource.load(
            () => {
                throw new Error('Falha conhecida')
            },
            { onError: error },
        )
        expect(resource.status).toBe('error')
        expect(resource.error).toBe('Falha conhecida')
        resource.load(() => Promise.resolve(tracker))
        await Promise.resolve()
        expect(resource.status).toBe('ready')
        resource.fail(new Error('Inferência indisponível'))
        expect(tracker.close).toHaveBeenCalledTimes(1)
        expect(resource.value).toBeNull()
        expect(resource.error).toBe('Inferência indisponível')
        resource.release()
        expect(resource.error).toBeNull()
    })
    it('não instala um recurso quando o consumidor deixou de estar ativo', async () => {
        const tracker = { close: vi.fn() },
            resource = new AsyncTrackerResource<{ close: () => void }>()
        resource.load(() => Promise.resolve(tracker), { alive: () => false })
        await Promise.resolve()
        expect(resource.value).toBeNull()
        expect(resource.status).toBe('idle')
        expect(tracker.close).toHaveBeenCalledTimes(1)
    })
})

it('ignores an asynchronous failure after its consumer releases the load', async () => {
    let reject: ((error: Error) => void) | undefined
    const resource = new AsyncTrackerResource<{ close: () => void }>(),
        failed = vi.fn()
    resource.load(
        () =>
            new Promise((_resolve, no) => {
                reject = no
            }),
        { onError: failed },
    )
    resource.release()
    reject?.(new Error('Late failure'))
    await Promise.resolve()
    expect(resource.status).toBe('idle')
    expect(resource.error).toBeNull()
    expect(failed).not.toHaveBeenCalled()
})

it('preserves domain-specific fallback messages through composition', async () => {
    const resource = new AsyncTrackerResource<{ close: () => void }>(
        () => 'Falha do domínio',
    )
    resource.load(() => Promise.reject('untyped failure'))
    await Promise.resolve()
    expect(resource.error).toBe('Falha do domínio')
})
