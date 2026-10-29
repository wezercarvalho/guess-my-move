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

describe('detectAll (várias mãos)', () => {
    const hand = (x: number) => Array.from({ length: 21 }, () => ({ x, y: 0.5 }))

    it('devolve todas as mãos, cada uma com o seu gesto', async () => {
        const detectForVideo = vi.fn(() => ({
            landmarks: [hand(0.2), hand(0.8)],
            gestures: [[{ categoryName: 'ILoveYou', score: 0.9 }], [{ categoryName: 'Open_Palm', score: 0.8 }]],
        }))
        const loader: MediaPipeLoader = {
            load: vi.fn().mockResolvedValue({}),
            create: vi.fn().mockResolvedValue({ detectForVideo, close: vi.fn() }),
        }
        const tracker = await createMediaPipeHandTracker(loader)
        const hands = tracker.detectAll?.(video, 1) ?? []
        expect(hands).toHaveLength(2)
        expect(hands[0]?.gesture).toEqual({ name: 'ILoveYou', score: 0.9 })
        expect(hands[1]?.gesture).toEqual({ name: 'Open_Palm', score: 0.8 })
        // `detect` segue devolvendo só a primeira mão.
        expect(tracker.detect(video, 2)?.landmarks[0]?.x).toBe(0.2)
    })

    it('sem mãos devolve lista vazia', async () => {
        const mp = landmarker([])
        const loader: MediaPipeLoader = {
            load: vi.fn().mockResolvedValue({}),
            create: vi.fn().mockResolvedValue(mp.instance),
        }
        const tracker = await createMediaPipeHandTracker(loader)
        expect(tracker.detectAll?.(video, 1)).toEqual([])
    })
})
