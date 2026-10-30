import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import { type FaceReading, headOrientationFromMatrix } from '@guess-my-move/swing'

import { type TrackerDelegate } from './handTracker.js'
import { type DelegatePreference } from './mediapipeTracker.js'

/**
 * Parte do `FaceLandmarker` usada aqui: a matriz de transformação facial e os pontos do
 * rosto por quadro. A matriz dá a orientação da cabeça (para o olhar); os pontos são
 * desenhados de forma transitória no overlay e descartados. Permite simular o MediaPipe nos
 * testes. Nenhum landmark nem blendshape é gravado, persistido ou logado.
 */
export interface FaceLandmarkerLike {
    detectForVideo(
        video: HTMLVideoElement,
        timestampMs: number,
    ): {
        facialTransformationMatrixes?: readonly { data: readonly number[] }[]
        faceLandmarks?: readonly (readonly { x: number; y: number; z?: number }[])[]
    }
    close(): void
}

/** Carregamento e criação do detector de rosto, separados para serem simulados. */
export interface FaceLoader {
    load(): Promise<unknown>
    create(fileset: unknown, delegate: TrackerDelegate): Promise<FaceLandmarkerLike>
}

/**
 * Detector de rosto por quadro de vídeo. A interface isola o MediaPipe: a tela e os
 * testes dependem só dela, e o núcleo (orientação -> olhar) continua puro.
 */
export interface FaceTracker {
    readonly delegate: TrackerDelegate
    /** Leitura do rosto no quadro: orientação da cabeça e pontos. `null` quando não há rosto. `timestampMs` deve crescer. */
    detect(video: HTMLVideoElement, timestampMs: number): FaceReading | null
    close(): void
}

export type CreateFaceTracker = () => Promise<FaceTracker>

/** Caminhos servidos pelo próprio app (preparados por `yarn prepare:assets`). */
const WASM_PATH = `${import.meta.env.BASE_URL}mediapipe/wasm`
const FACE_MODEL_PATH = `${import.meta.env.BASE_URL}mediapipe/face_landmarker.task`

/**
 * Carregador real: o modelo de rosto local do app, um rosto, modo de vídeo, só a matriz de
 * transformação (sem blendshapes, que não são usados). Nenhuma imagem é gravada ou enviada.
 */
export const realFaceLoader: FaceLoader = {
    load: () => FilesetResolver.forVisionTasks(WASM_PATH),
    create: (fileset, delegate) =>
        FaceLandmarker.createFromOptions(
            fileset as Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>,
            {
                baseOptions: { modelAssetPath: FACE_MODEL_PATH, delegate },
                runningMode: 'VIDEO',
                numFaces: 1,
                outputFaceBlendshapes: false,
                outputFacialTransformationMatrixes: true,
            },
        ),
}

/** Preferência de delegate reaproveitada do detector de mão. */
export type { DelegatePreference } from './mediapipeTracker.js'

/**
 * Cria o detector de rosto com o MediaPipe. No modo automático tenta o GPU e recua para o
 * CPU quando a criação falha; com um delegate forçado não há recuo. A orientação da cabeça
 * sai da matriz de transformação facial por funções puras do pacote.
 */
export async function createMediaPipeFaceTracker(
    loader: FaceLoader = realFaceLoader,
    preference: DelegatePreference = 'auto',
): Promise<FaceTracker> {
    let fileset: unknown
    try {
        fileset = await loader.load()
    } catch {
        throw new Error(
            'Não foi possível carregar os arquivos do detector de rosto. Rode "yarn prepare:assets" e recarregue a página.',
        )
    }

    const attempts: TrackerDelegate[] = preference === 'auto' ? ['GPU', 'CPU'] : [preference]
    let landmarker: FaceLandmarkerLike | undefined
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
            `Não foi possível iniciar o detector de rosto neste navegador (${
                attempts.length > 1 ? 'GPU e CPU falharam' : `${preference} falhou`
            }).`,
        )
    }

    const active = landmarker
    return {
        delegate,
        detect(video, timestampMs): FaceReading | null {
            const result = active.detectForVideo(video, timestampMs)
            const matrix = result.facialTransformationMatrixes?.[0]?.data
            const points = result.faceLandmarks?.[0]
            // Sem matriz E sem pontos, não há rosto neste quadro.
            if (!matrix && !points) return null
            const orientation = matrix ? headOrientationFromMatrix([...matrix]) : null
            // Os pontos são copiados para desenho transitório; nada é guardado.
            const landmarks = points
                ? points.map((p) => (p.z === undefined ? { x: p.x, y: p.y } : { x: p.x, y: p.y, z: p.z }))
                : []
            return { orientation, landmarks }
        },
        close() {
            active.close()
        },
    }
}
