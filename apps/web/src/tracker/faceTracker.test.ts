import { describe, expect, it, vi } from 'vitest'

import {
    createMediaPipeFaceTracker,
    type FaceLandmarkerLike,
    type FaceLoader,
} from './faceTracker.js'

const video = {} as HTMLVideoElement

/** Matriz 4x4 (coluna-maior) de uma guinada pura, como o MediaPipe devolve. */
function yawMatrix(yaw: number): number[] {
    const c = Math.cos(yaw)
    const s = Math.sin(yaw)
    // prettier-ignore
    return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]
}

/** Detector de rosto simulado. */
function faceLandmarker(matrixes: number[][] = []) {
    const detectForVideo = vi.fn(() => ({
        facialTransformationMatrixes: matrixes.map((data) => ({ data })),
    }))
    const close = vi.fn()
    const instance: FaceLandmarkerLike = { detectForVideo, close }
    return { instance, detectForVideo, close }
}

function loaderWith(create: FaceLoader['create']) {
    const createSpy = vi.fn(create)
    const loader: FaceLoader = {
        load: vi.fn().mockResolvedValue({ fileset: true }),
        create: createSpy,
    }
    return { loader, createSpy }
}

describe('createMediaPipeFaceTracker', () => {
    it('usa o delegate GPU quando a criação funciona', async () => {
        const fl = faceLandmarker()
        const { loader, createSpy } = loaderWith(() => Promise.resolve(fl.instance))
        const tracker = await createMediaPipeFaceTracker(loader)
        expect(tracker.delegate).toBe('GPU')
        expect(createSpy).toHaveBeenCalledWith({ fileset: true }, 'GPU')
    })

    it('recua para CPU quando o GPU falha', async () => {
        const fl = faceLandmarker()
        const { loader, createSpy } = loaderWith((_fileset, delegate) =>
            delegate === 'GPU' ? Promise.reject(new Error('sem WebGL')) : Promise.resolve(fl.instance),
        )
        const tracker = await createMediaPipeFaceTracker(loader)
        expect(tracker.delegate).toBe('CPU')
        expect(createSpy).toHaveBeenCalledTimes(2)
    })

    it('falha com mensagem em português quando nenhum delegate funciona', async () => {
        const { loader } = loaderWith(() => Promise.reject(new Error('quebrou')))
        await expect(createMediaPipeFaceTracker(loader)).rejects.toThrow(
            /não foi possível iniciar o detector de rosto/i,
        )
    })

    it('falha quando os arquivos do detector não carregam', async () => {
        const loader: FaceLoader = {
            load: vi.fn().mockRejectedValue(new Error('404')),
            create: vi.fn(),
        }
        await expect(createMediaPipeFaceTracker(loader)).rejects.toThrow(
            /não foi possível carregar os arquivos do detector de rosto/i,
        )
    })

    it('converte a matriz do primeiro rosto na orientação da cabeça', async () => {
        const angle = Math.PI / 9
        const fl = faceLandmarker([yawMatrix(angle)])
        const tracker = await createMediaPipeFaceTracker(
            loaderWith(() => Promise.resolve(fl.instance)).loader,
        )
        const orientation = tracker.detect(video, 33)
        expect(orientation).not.toBeNull()
        expect(orientation?.yaw).toBeCloseTo(angle, 4)
        expect(fl.detectForVideo).toHaveBeenCalledWith(video, 33)
    })

    it('devolve null quando não há rosto', async () => {
        const fl = faceLandmarker([])
        const tracker = await createMediaPipeFaceTracker(
            loaderWith(() => Promise.resolve(fl.instance)).loader,
        )
        expect(tracker.detect(video, 10)).toBeNull()
    })

    it('devolve null quando a matriz tem tamanho inválido', async () => {
        const fl = faceLandmarker([[1, 2, 3]])
        const tracker = await createMediaPipeFaceTracker(
            loaderWith(() => Promise.resolve(fl.instance)).loader,
        )
        expect(tracker.detect(video, 10)).toBeNull()
    })

    it('close libera o detector', async () => {
        const fl = faceLandmarker()
        const tracker = await createMediaPipeFaceTracker(
            loaderWith(() => Promise.resolve(fl.instance)).loader,
        )
        tracker.close()
        expect(fl.close).toHaveBeenCalledTimes(1)
    })
})
