import { describe, expect, it, vi } from 'vitest'

import {
    CAPTURE_LIMITS,
    captureFrames,
    type CaptureCanvas,
    type CaptureConfig,
    CaptureError,
    type CaptureDeps,
    DEFAULT_CAPTURE_CONFIG,
    validateConfig,
} from './frameCapture.js'

/** Canvas simulado: `toDataURL` retorna um payload de tamanho controlável. */
function makeFakeCanvas(dataUrl: string): {
    canvas: CaptureCanvas
    drawImage: ReturnType<typeof vi.fn>
} {
    const drawImage = vi.fn()
    const canvas: CaptureCanvas = {
        getContext: () => ({ drawImage }),
        toDataURL: () => dataUrl,
    }
    return { canvas, drawImage }
}

/** Monta deps simuladas com relógio incremental e sleep instantâneo. */
function makeDeps(canvas: CaptureCanvas): {
    deps: CaptureDeps
    sleep: ReturnType<typeof vi.fn>
} {
    let t = 0
    const sleep = vi.fn((ms: number, signal?: AbortSignal) => {
        if (signal?.aborted) {
            return Promise.reject(new CaptureError('aborted', 'cancelada'))
        }
        t += ms
        return Promise.resolve()
    })
    const deps: CaptureDeps = {
        now: () => t,
        sleep,
        createCanvas: () => canvas,
    }
    return { deps, sleep }
}

/** Data URL JPEG com N bytes aproximados de payload base64. */
function dataUrlOfBytes(bytes: number): string {
    // 4 chars base64 ≈ 3 bytes; geramos chars suficientes.
    const chars = Math.ceil((bytes * 4) / 3)
    return `data:image/jpeg;base64,${'A'.repeat(chars)}`
}

const fakeVideo = {} as HTMLVideoElement

describe('validateConfig', () => {
    it('aceita a configuração padrão', () => {
        expect(() => validateConfig(DEFAULT_CAPTURE_CONFIG)).not.toThrow()
    })

    it('recusa frameCount acima do limite', () => {
        const config: CaptureConfig = {
            ...DEFAULT_CAPTURE_CONFIG,
            frameCount: CAPTURE_LIMITS.maxFrameCount + 1,
        }
        expect(() => validateConfig(config)).toThrowError(/excede o limite/i)
    })

    it('recusa resolução acima do limite', () => {
        expect(() =>
            validateConfig({
                ...DEFAULT_CAPTURE_CONFIG,
                width: CAPTURE_LIMITS.maxWidth + 1,
            }),
        ).toThrowError(/largura/i)
    })

    it('recusa qualidade fora de (0,1]', () => {
        expect(() =>
            validateConfig({ ...DEFAULT_CAPTURE_CONFIG, quality: 0 }),
        ).toThrowError(/qualidade/i)
        expect(() =>
            validateConfig({ ...DEFAULT_CAPTURE_CONFIG, quality: 1.2 }),
        ).toThrowError(/qualidade/i)
    })
})

describe('captureFrames', () => {
    it('captura N frames ordenados com timestampMs crescente', async () => {
        const { canvas, drawImage } = makeFakeCanvas(dataUrlOfBytes(1000))
        const { deps, sleep } = makeDeps(canvas)
        const config: CaptureConfig = {
            ...DEFAULT_CAPTURE_CONFIG,
            frameCount: 6,
            windowMs: 2400,
        }

        const frames = await captureFrames(fakeVideo, config, deps)

        expect(frames).toHaveLength(6)
        expect(drawImage).toHaveBeenCalledTimes(6)
        // 5 esperas entre 6 frames.
        expect(sleep).toHaveBeenCalledTimes(5)
        // Timestamps estritamente crescentes.
        const ts = frames.map((f) => f.timestampMs)
        expect(ts[0]).toBe(0)
        for (let i = 1; i < ts.length; i += 1) {
            expect(ts[i]).toBeGreaterThan(ts[i - 1])
        }
        // Espaçamento ~ windowMs/(N-1) = 480ms.
        expect(ts[ts.length - 1]).toBe(2400)
    })

    it('produz data base64 sem prefixo data: e mimeType jpeg', async () => {
        const { canvas } = makeFakeCanvas(dataUrlOfBytes(500))
        const { deps } = makeDeps(canvas)

        const frames = await captureFrames(fakeVideo, DEFAULT_CAPTURE_CONFIG, deps)

        for (const frame of frames) {
            expect(frame.mimeType).toBe('image/jpeg')
            expect(frame.data.startsWith('data:')).toBe(false)
            expect(frame.data.startsWith('AAAA')).toBe(true)
        }
    })

    it('recusa quando um frame individual excede o limite', async () => {
        const big = dataUrlOfBytes(CAPTURE_LIMITS.maxFrameBytes + 1000)
        const { canvas } = makeFakeCanvas(big)
        const { deps } = makeDeps(canvas)

        await expect(
            captureFrames(fakeVideo, DEFAULT_CAPTURE_CONFIG, deps),
        ).rejects.toMatchObject({ code: 'frame_too_large' })
    })

    it('recusa quando o total dos frames excede o limite', async () => {
        // Cada frame fica abaixo do limite individual, mas a soma dos 6 estoura
        // o total (6 × 1,2 MB = 7,2 MB > 6 MB).
        const perFrame = 1_200_000
        expect(perFrame).toBeLessThan(CAPTURE_LIMITS.maxFrameBytes)
        const { canvas } = makeFakeCanvas(dataUrlOfBytes(perFrame))
        const { deps } = makeDeps(canvas)

        await expect(
            captureFrames(fakeVideo, DEFAULT_CAPTURE_CONFIG, deps),
        ).rejects.toMatchObject({ code: 'total_too_large' })
    })

    it('lança no_video quando o vídeo é null', async () => {
        const { canvas } = makeFakeCanvas(dataUrlOfBytes(100))
        const { deps } = makeDeps(canvas)
        await expect(
            captureFrames(null, DEFAULT_CAPTURE_CONFIG, deps),
        ).rejects.toMatchObject({ code: 'no_video' })
    })

    it('cancela via AbortSignal já abortado antes de capturar', async () => {
        const { canvas } = makeFakeCanvas(dataUrlOfBytes(100))
        const { deps } = makeDeps(canvas)
        const controller = new AbortController()
        controller.abort()

        await expect(
            captureFrames(fakeVideo, DEFAULT_CAPTURE_CONFIG, deps, controller.signal),
        ).rejects.toMatchObject({ code: 'aborted' })
    })

    it('cancela via AbortSignal durante a janela de captura', async () => {
        const { canvas } = makeFakeCanvas(dataUrlOfBytes(100))
        const controller = new AbortController()
        let t = 0
        const deps: CaptureDeps = {
            now: () => t,
            sleep: (ms) => {
                // Aborta no meio da captura.
                controller.abort()
                t += ms
                return controller.signal.aborted
                    ? Promise.reject(new CaptureError('aborted', 'cancelada'))
                    : Promise.resolve()
            },
            createCanvas: () => canvas,
        }

        await expect(
            captureFrames(fakeVideo, DEFAULT_CAPTURE_CONFIG, deps, controller.signal),
        ).rejects.toMatchObject({ code: 'aborted' })
    })

    it('captura um único frame sem esperas quando frameCount=1', async () => {
        const { canvas } = makeFakeCanvas(dataUrlOfBytes(100))
        const { deps, sleep } = makeDeps(canvas)
        const frames = await captureFrames(
            fakeVideo,
            { ...DEFAULT_CAPTURE_CONFIG, frameCount: 1 },
            deps,
        )
        expect(frames).toHaveLength(1)
        expect(frames[0].timestampMs).toBe(0)
        expect(sleep).not.toHaveBeenCalled()
    })

    it('não registra conteúdo de imagem no console', async () => {
        const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
        const { canvas } = makeFakeCanvas(dataUrlOfBytes(100))
        const { deps } = makeDeps(canvas)
        await captureFrames(fakeVideo, DEFAULT_CAPTURE_CONFIG, deps)
        expect(spy).not.toHaveBeenCalled()
        spy.mockRestore()
    })
})
