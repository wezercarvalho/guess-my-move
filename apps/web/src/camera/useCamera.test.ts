import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useCamera } from './useCamera.js'
import { createFakeStream, namedError } from '../test-utils/fakeMedia.js'

describe('useCamera', () => {
    it('começa em idle', () => {
        const { result } = renderHook(() =>
            useCamera({ getUserMedia: vi.fn() }),
        )
        expect(result.current.status).toBe('idle')
        expect(result.current.isActive).toBe(false)
        expect(result.current.stream).toBeNull()
    })

    it('ativa a câmera e expõe a stream', async () => {
        const { stream } = createFakeStream()
        const getUserMedia = vi.fn().mockResolvedValue(stream)
        const { result } = renderHook(() => useCamera({ getUserMedia }))

        await act(async () => {
            await result.current.start()
        })

        expect(result.current.status).toBe('active')
        expect(result.current.isActive).toBe(true)
        expect(result.current.stream).toBe(stream)
        expect(getUserMedia).toHaveBeenCalledTimes(1)
    })

    it('entra em denied e NÃO reusa a câmera sem nova ação', async () => {
        const getUserMedia = vi
            .fn()
            .mockRejectedValue(namedError('NotAllowedError'))
        const { result } = renderHook(() => useCamera({ getUserMedia }))

        await act(async () => {
            await result.current.start()
        })

        expect(result.current.status).toBe('denied')
        expect(result.current.errorMessage).toMatch(/negada/i)
        expect(result.current.stream).toBeNull()
        // Nenhuma segunda chamada automática: só uma tentativa foi feita.
        expect(getUserMedia).toHaveBeenCalledTimes(1)
    })

    it('entra em unavailable quando getUserMedia é null', async () => {
        const { result } = renderHook(() => useCamera({ getUserMedia: null }))

        await act(async () => {
            await result.current.start()
        })

        expect(result.current.status).toBe('unavailable')
        expect(result.current.errorMessage).toMatch(/dispon/i)
    })

    it('stop() encerra todas as tracks e volta a idle', async () => {
        const { stream, tracks } = createFakeStream(2)
        const getUserMedia = vi.fn().mockResolvedValue(stream)
        const { result } = renderHook(() => useCamera({ getUserMedia }))

        await act(async () => {
            await result.current.start()
        })
        act(() => {
            result.current.stop()
        })

        expect(tracks.every((t) => t.stopped)).toBe(true)
        expect(result.current.status).toBe('idle')
        expect(result.current.stream).toBeNull()
        expect(result.current.isActive).toBe(false)
    })

    it('encerra a stream ao desmontar', async () => {
        const { stream, tracks } = createFakeStream()
        const getUserMedia = vi.fn().mockResolvedValue(stream)
        const { result, unmount } = renderHook(() => useCamera({ getUserMedia }))

        await act(async () => {
            await result.current.start()
        })
        unmount()

        await waitFor(() => {
            expect(tracks.every((t) => t.stopped)).toBe(true)
        })
    })
})
