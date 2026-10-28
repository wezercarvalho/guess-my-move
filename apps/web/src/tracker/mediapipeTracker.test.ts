import { describe, expect, it, vi } from 'vitest'

import {
    createMediaPipeHandTracker,
    delegatePreferenceFromSearch,
    type HandLandmarkerLike,
    type MediaPipeLoader,
} from './mediapipeTracker.js'

const video = {} as HTMLVideoElement

/** Detector simulado; os espiões ficam soltos para as asserções (sem método sem `this`). */
function landmarker(points: { x: number; y: number }[][] = []) {
    const detectForVideo = vi.fn(() => ({ landmarks: points }))
    const close = vi.fn()
    const instance: HandLandmarkerLike = { detectForVideo, close }
    return { instance, detectForVideo, close }
}

function loaderWith(create: MediaPipeLoader['create']) {
    const createSpy = vi.fn(create)
    const loader: MediaPipeLoader = {
        load: vi.fn().mockResolvedValue({ fileset: true }),
        create: createSpy,
    }
    return { loader, createSpy }
}

describe('createMediaPipeHandTracker', () => {
    it('usa o delegate GPU quando a criação funciona', async () => {
        const mp = landmarker()
        const { loader, createSpy } = loaderWith(() => Promise.resolve(mp.instance))
        const tracker = await createMediaPipeHandTracker(loader)
        expect(tracker.delegate).toBe('GPU')
        expect(createSpy).toHaveBeenCalledTimes(1)
        expect(createSpy).toHaveBeenCalledWith({ fileset: true }, 'GPU')
    })

    it('recua para CPU quando o GPU falha', async () => {
        const mp = landmarker()
        const { loader, createSpy } = loaderWith((_fileset, delegate) =>
            delegate === 'GPU'
                ? Promise.reject(new Error('sem WebGL'))
                : Promise.resolve(mp.instance),
        )
        const tracker = await createMediaPipeHandTracker(loader)
        expect(tracker.delegate).toBe('CPU')
        expect(createSpy).toHaveBeenCalledTimes(2)
    })

    it('falha com mensagem em português quando nenhum delegate funciona', async () => {
        const { loader } = loaderWith(() => Promise.reject(new Error('quebrou')))
        await expect(createMediaPipeHandTracker(loader)).rejects.toThrow(
            /não foi possível iniciar o detector de mão/i,
        )
    })

    it('falha quando os arquivos do detector não carregam', async () => {
        const loader: MediaPipeLoader = {
            load: vi.fn().mockRejectedValue(new Error('404')),
            create: vi.fn(),
        }
        await expect(createMediaPipeHandTracker(loader)).rejects.toThrow(
            /não foi possível carregar os arquivos do detector/i,
        )
    })

    it('devolve os landmarks da primeira mão e null sem mão', async () => {
        const hand = [
            { x: 0.1, y: 0.2 },
            { x: 0.3, y: 0.4 },
        ]
        const mp = landmarker([hand, [{ x: 0.9, y: 0.9 }]])
        const tracker = await createMediaPipeHandTracker(
            loaderWith(() => Promise.resolve(mp.instance)).loader,
        )
        expect(tracker.detect(video, 33)).toEqual({ landmarks: hand })
        expect(mp.detectForVideo).toHaveBeenCalledWith(video, 33)

        const empty = await createMediaPipeHandTracker(
            loaderWith(() => Promise.resolve(landmarker([]).instance)).loader,
        )
        expect(empty.detect(video, 66)).toBeNull()
    })

    it('com o reconhecedor de gestos, devolve também o gesto de maior pontuação da primeira mão', async () => {
        const hand = [{ x: 0.1, y: 0.2 }]
        const detectForVideo = vi.fn(() => ({
            landmarks: [hand],
            gestures: [
                [
                    { categoryName: 'Thumb_Up', score: 0.91 },
                    { categoryName: 'None', score: 0.05 },
                ],
            ],
        }))
        const instance: HandLandmarkerLike = { detectForVideo, close: vi.fn() }
        const tracker = await createMediaPipeHandTracker(
            loaderWith(() => Promise.resolve(instance)).loader,
        )
        expect(tracker.detect(video, 33)).toEqual({
            landmarks: hand,
            gesture: { name: 'Thumb_Up', score: 0.91 },
        })
    })

    it('sem gestos na resposta, a mão vem sem o campo gesture', async () => {
        const hand = [{ x: 0.1, y: 0.2 }]
        const detectForVideo = vi.fn(() => ({ landmarks: [hand], gestures: [] }))
        const instance: HandLandmarkerLike = { detectForVideo, close: vi.fn() }
        const tracker = await createMediaPipeHandTracker(
            loaderWith(() => Promise.resolve(instance)).loader,
        )
        expect(tracker.detect(video, 33)).toEqual({ landmarks: hand })
    })

    it('close libera o detector', async () => {
        const mp = landmarker()
        const tracker = await createMediaPipeHandTracker(
            loaderWith(() => Promise.resolve(mp.instance)).loader,
        )
        tracker.close()
        expect(mp.close).toHaveBeenCalledTimes(1)
    })
})

describe('delegate forçado', () => {
    it('CPU forçado não tenta o GPU', async () => {
        const mp = landmarker()
        const { loader, createSpy } = loaderWith(() => Promise.resolve(mp.instance))
        const tracker = await createMediaPipeHandTracker(loader, 'CPU')
        expect(tracker.delegate).toBe('CPU')
        expect(createSpy).toHaveBeenCalledTimes(1)
        expect(createSpy).toHaveBeenCalledWith({ fileset: true }, 'CPU')
    })

    it('GPU forçado não recua para o CPU e falha com mensagem', async () => {
        const { loader, createSpy } = loaderWith(() => Promise.reject(new Error('sem WebGL')))
        await expect(createMediaPipeHandTracker(loader, 'GPU')).rejects.toThrow(
            /não foi possível iniciar o detector de mão.*GPU/i,
        )
        expect(createSpy).toHaveBeenCalledTimes(1)
    })

    it('lê a preferência do parâmetro delegate da URL', () => {
        expect(delegatePreferenceFromSearch('?delegate=cpu')).toBe('CPU')
        expect(delegatePreferenceFromSearch('?x=1&delegate=GPU')).toBe('GPU')
        expect(delegatePreferenceFromSearch('')).toBe('auto')
        expect(delegatePreferenceFromSearch('?delegate=outro')).toBe('auto')
    })
})
