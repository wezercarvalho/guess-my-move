import { type HandLandmark } from '@guess-my-move/core'

/** Delegate de inferência do MediaPipe: GPU (WebGL) ou CPU (WebAssembly). */
export type TrackerDelegate = 'GPU' | 'CPU'

/** Mão detectada em um quadro: 21 landmarks normalizados (0 a 1). */
export interface TrackedHand {
    landmarks: readonly HandLandmark[]
    /** Gesto pronto reconhecido (só quando o detector é o reconhecedor de gestos). */
    gesture?: { name: string; score: number } | null
}

/**
 * Detector de mão por quadro de vídeo. A interface isola o MediaPipe: a tela e
 * os testes dependem só dela, e o núcleo continua puro.
 */
export interface HandTracker {
    readonly delegate: TrackerDelegate
    /** `timestampMs` deve crescer a cada chamada (exigência do modo de vídeo). */
    detect(video: HTMLVideoElement, timestampMs: number): TrackedHand | null
    /** Todas as mãos do quadro (as duas, quando o detector foi criado para isso). */
    detectAll?(video: HTMLVideoElement, timestampMs: number): TrackedHand[]
    close(): void
}

/** Cria o detector; rejeita com mensagem legível quando não consegue. */
export type CreateHandTracker = () => Promise<HandTracker>
