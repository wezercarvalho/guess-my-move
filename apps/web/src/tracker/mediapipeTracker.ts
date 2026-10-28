import { FilesetResolver, GestureRecognizer, HandLandmarker } from '@mediapipe/tasks-vision'

import {
    type HandTracker,
    type TrackedHand,
    type TrackerDelegate,
} from './handTracker.js'

/**
 * Parte do `HandLandmarker` (ou do `GestureRecognizer`, que devolve também os gestos)
 * usada aqui; permite simular o MediaPipe nos testes.
 */
export interface HandLandmarkerLike {
    detectForVideo(
        video: HTMLVideoElement,
        timestampMs: number,
    ): {
        landmarks: readonly (readonly { x: number; y: number }[])[]
        gestures?: readonly (readonly { categoryName: string; score: number }[])[]
    }
    close(): void
}

/** Carregamento e criação do MediaPipe, separados para serem simulados. */
export interface MediaPipeLoader {
    load(): Promise<unknown>
    create(fileset: unknown, delegate: TrackerDelegate): Promise<HandLandmarkerLike>
}

/** Caminhos servidos pelo próprio app (preparados por `yarn prepare:assets`). */
const WASM_PATH = `${import.meta.env.BASE_URL}mediapipe/wasm`
const MODEL_PATH = `${import.meta.env.BASE_URL}mediapipe/hand_landmarker.task`
const GESTURE_MODEL_PATH = `${import.meta.env.BASE_URL}mediapipe/gesture_recognizer.task`

/** Carregador real: arquivos locais do app, uma mão, modo de vídeo. */
export const realMediaPipeLoader: MediaPipeLoader = {
    load: () => FilesetResolver.forVisionTasks(WASM_PATH),
    create: (fileset, delegate) =>
        HandLandmarker.createFromOptions(
            fileset as Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>,
            {
                baseOptions: { modelAssetPath: MODEL_PATH, delegate },
                runningMode: 'VIDEO',
                numHands: 1,
            },
        ),
}

/**
 * Carregador do reconhecedor de gestos (jogo das bolinhas): os mesmos landmarks do
 * `HandLandmarker`, mais o gesto pronto (punho, palma aberta, polegar para cima…).
 * O jogo de cartas segue com o `realMediaPipeLoader`.
 */
function gestureLoader(numHands: number): MediaPipeLoader {
    return {
        load: () => FilesetResolver.forVisionTasks(WASM_PATH),
        create: async (fileset, delegate) => {
            const recognizer = await GestureRecognizer.createFromOptions(
                fileset as Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>,
                {
                    baseOptions: { modelAssetPath: GESTURE_MODEL_PATH, delegate },
                    runningMode: 'VIDEO',
                    numHands,
                },
            )
            return {
                detectForVideo: (video, timestampMs) =>
                    recognizer.recognizeForVideo(video, timestampMs),
                close: () => {
                    recognizer.close()
                },
            }
        },
    }
}

export const realGestureLoader: MediaPipeLoader = gestureLoader(1)

/** Como o `realGestureLoader`, mas com até duas mãos (o Arranha-Teia usa uma teia por mão). */
export const realTwoHandGestureLoader: MediaPipeLoader = gestureLoader(2)

/** Preferência de delegate: automática (GPU com recuo para CPU) ou forçada. */
export type DelegatePreference = 'auto' | TrackerDelegate

/** Lê `?delegate=cpu|gpu` da URL; qualquer outro valor mantém o modo automático. */
export function delegatePreferenceFromSearch(search: string): DelegatePreference {
    const value = new URLSearchParams(search).get('delegate')?.toUpperCase()
    return value === 'CPU' || value === 'GPU' ? value : 'auto'
}

/**
 * Cria o detector de mão com o MediaPipe. No modo automático tenta o delegate
 * GPU e recua para o CPU quando a criação falha; com um delegate forçado não há
 * recuo. O delegate efetivo fica em `delegate`.
 */
export async function createMediaPipeHandTracker(
    loader: MediaPipeLoader = realMediaPipeLoader,
    preference: DelegatePreference = 'auto',
): Promise<HandTracker> {
    let fileset: unknown
    try {
        fileset = await loader.load()
    } catch {
        throw new Error(
            'Não foi possível carregar os arquivos do detector de mão. Rode "yarn prepare:assets" e recarregue a página.',
        )
    }

    const attempts: TrackerDelegate[] = preference === 'auto' ? ['GPU', 'CPU'] : [preference]
    let landmarker: HandLandmarkerLike | undefined
    let delegate: TrackerDelegate = attempts[0] ?? 'GPU'
    for (const candidate of attempts) {
        try {
            landmarker = await loader.create(fileset, candidate)
            delegate = candidate
            break
        } catch {
            // tenta o próximo delegate, se houver
        }
    }
    if (!landmarker) {
        throw new Error(
            `Não foi possível iniciar o detector de mão neste navegador (${
                attempts.length > 1 ? 'GPU e CPU falharam' : `${preference} falhou`
            }).`,
        )
    }

    const active = landmarker
    const toHand = (
        result: ReturnType<HandLandmarkerLike['detectForVideo']>,
        index: number,
    ): TrackedHand | null => {
        const landmarks = result.landmarks[index]
        if (!landmarks) return null
        const top = result.gestures?.[index]?.[0]
        return top
            ? { landmarks, gesture: { name: top.categoryName, score: top.score } }
            : { landmarks }
    }
    return {
        delegate,
        detect(video, timestampMs): TrackedHand | null {
            return toHand(active.detectForVideo(video, timestampMs), 0)
        },
        detectAll(video, timestampMs): TrackedHand[] {
            const result = active.detectForVideo(video, timestampMs)
            const hands: TrackedHand[] = []
            for (let index = 0; index < result.landmarks.length; index++) {
                const hand = toHand(result, index)
                if (hand) hands.push(hand)
            }
            return hands
        },
        close() {
            active.close()
        },
    }
}
