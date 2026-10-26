import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'

import {
    type HandTracker,
    type TrackedHand,
    type TrackerDelegate,
} from './handTracker.js'

/** Parte do `HandLandmarker` usada aqui; permite simular o MediaPipe nos testes. */
export interface HandLandmarkerLike {
    detectForVideo(
        video: HTMLVideoElement,
        timestampMs: number,
    ): { landmarks: readonly (readonly { x: number; y: number }[])[] }
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
 * Cria o detector de mão com o MediaPipe. Tenta o delegate GPU e recua para o
 * CPU quando a criação falha; o delegate efetivo fica em `delegate`.
 */
export async function createMediaPipeHandTracker(
    loader: MediaPipeLoader = realMediaPipeLoader,
): Promise<HandTracker> {
    let fileset: unknown
    try {
        fileset = await loader.load()
    } catch {
        throw new Error(
            'Não foi possível carregar os arquivos do detector de mão. Rode "yarn prepare:assets" e recarregue a página.',
        )
    }

    let landmarker: HandLandmarkerLike | undefined
    let delegate: TrackerDelegate = 'GPU'
    try {
        landmarker = await loader.create(fileset, 'GPU')
    } catch {
        delegate = 'CPU'
        try {
            landmarker = await loader.create(fileset, 'CPU')
        } catch {
            throw new Error(
                'Não foi possível iniciar o detector de mão neste navegador (GPU e CPU falharam).',
            )
        }
    }

    const active = landmarker
    return {
        delegate,
        detect(video, timestampMs): TrackedHand | null {
            const first = active.detectForVideo(video, timestampMs).landmarks[0]
            return first ? { landmarks: first } : null
        },
        close() {
            active.close()
        },
    }
}
