import { type CapturedFrame } from '@guess-my-move/core'

/**
 * Captura de frames da PoC.
 *
 * Captura, sob comando explícito, uma janela curta de frames ordenados a partir
 * de um elemento `<video>` ativo. Cada frame é desenhado em um canvas offscreen
 * e codificado como JPEG base64 (sem o prefixo `data:`). Os frames são
 * transitórios: nunca persistidos, nunca gravados em `localStorage`, nunca
 * logados — o conteúdo de imagem jamais vai para `console`.
 */

/** Configuração da captura; todos os campos têm padrão seguro. */
export interface CaptureConfig {
    /** Quantidade de frames a capturar (padrão 6). */
    frameCount: number
    /** Janela total aproximada da captura, em ms (padrão 2400). */
    windowMs: number
    /** Largura alvo do frame, em px (padrão 640). */
    width: number
    /** Altura alvo do frame, em px (padrão 480). */
    height: number
    /** Qualidade do JPEG, de 0 a 1 (padrão 0,7). */
    quality: number
}

/** Configuração padrão: 6 frames em ~2,4 s, 640x480, JPEG q≈0,7. */
export const DEFAULT_CAPTURE_CONFIG: CaptureConfig = {
    frameCount: 6,
    windowMs: 2400,
    width: 640,
    height: 480,
    quality: 0.7,
}

/**
 * Limites rígidos de segurança (espelham os limites do servidor). Valores de
 * configuração acima destes são recusados com erro claro antes de capturar.
 */
export const CAPTURE_LIMITS = {
    maxFrameCount: 12,
    maxWidth: 1280,
    maxHeight: 720,
    /** Tamanho máximo de um único frame (base64), em bytes. */
    maxFrameBytes: 1_500_000,
    /** Tamanho máximo somado de todos os frames (base64), em bytes. */
    maxTotalBytes: 6_000_000,
} as const

/** Erro de captura com código estável para a UI tratar. */
export class CaptureError extends Error {
    constructor(
        readonly code:
            | 'invalid_config'
            | 'no_video'
            | 'frame_too_large'
            | 'total_too_large'
            | 'encode_failed'
            | 'aborted',
        message: string,
    ) {
        super(message)
        this.name = 'CaptureError'
    }
}

/** Dependências injetáveis para teste (relógio, espera e fábrica de canvas). */
export interface CaptureDeps {
    now: () => number
    sleep: (ms: number, signal?: AbortSignal) => Promise<void>
    createCanvas: (width: number, height: number) => CaptureCanvas
}

/** Subconjunto do canvas que a captura usa (facilita simular em teste). */
export interface CaptureCanvas {
    getContext(contextId: '2d'): CaptureCanvasContext | null
    toDataURL(type: string, quality: number): string
}

/** Subconjunto do contexto 2D usado pela captura. */
export interface CaptureCanvasContext {
    drawImage(
        source: CanvasImageSource,
        dx: number,
        dy: number,
        dw: number,
        dh: number,
    ): void
}

/** Valida a configuração contra os limites rígidos; lança `CaptureError`. */
export function validateConfig(config: CaptureConfig): void {
    const { frameCount, width, height, quality, windowMs } = config
    if (!Number.isInteger(frameCount) || frameCount < 1) {
        throw new CaptureError(
            'invalid_config',
            'A quantidade de frames deve ser um inteiro maior ou igual a 1.',
        )
    }
    if (frameCount > CAPTURE_LIMITS.maxFrameCount) {
        throw new CaptureError(
            'invalid_config',
            `A quantidade de frames (${String(frameCount)}) excede o limite de ${String(CAPTURE_LIMITS.maxFrameCount)}.`,
        )
    }
    if (width < 1 || width > CAPTURE_LIMITS.maxWidth) {
        throw new CaptureError(
            'invalid_config',
            `A largura (${String(width)}) excede o limite de ${String(CAPTURE_LIMITS.maxWidth)} px.`,
        )
    }
    if (height < 1 || height > CAPTURE_LIMITS.maxHeight) {
        throw new CaptureError(
            'invalid_config',
            `A altura (${String(height)}) excede o limite de ${String(CAPTURE_LIMITS.maxHeight)} px.`,
        )
    }
    if (quality <= 0 || quality > 1) {
        throw new CaptureError(
            'invalid_config',
            'A qualidade do JPEG deve ficar entre 0 (exclusivo) e 1.',
        )
    }
    if (windowMs < 0) {
        throw new CaptureError(
            'invalid_config',
            'A janela de captura não pode ser negativa.',
        )
    }
}

/** Remove o prefixo `data:image/...;base64,` de um data URL. */
function stripDataUrlPrefix(dataUrl: string): string {
    const comma = dataUrl.indexOf(',')
    return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
}

/** Tamanho aproximado, em bytes, de uma string base64 decodificada. */
function base64Bytes(base64: string): number {
    const len = base64.length
    if (len === 0) return 0
    const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
    return Math.floor((len * 3) / 4) - padding
}

/** Deps padrão do navegador. */
export function defaultCaptureDeps(): CaptureDeps {
    return {
        now: () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
        sleep: (ms, signal) =>
            new Promise<void>((resolve, reject) => {
                if (signal?.aborted) {
                    reject(new CaptureError('aborted', 'Captura cancelada.'))
                    return
                }
                const timer = setTimeout(() => {
                    signal?.removeEventListener('abort', onAbort)
                    resolve()
                }, ms)
                const onAbort = () => {
                    clearTimeout(timer)
                    reject(new CaptureError('aborted', 'Captura cancelada.'))
                }
                signal?.addEventListener('abort', onAbort, { once: true })
            }),
        createCanvas: (width, height) => {
            const canvas = document.createElement('canvas')
            canvas.width = width
            canvas.height = height
            return canvas
        },
    }
}

/**
 * Captura `frameCount` frames ordenados a partir do `<video>`, espaçados ao
 * longo de `windowMs`. Cada frame carrega `timestampMs` relativo ao início da
 * captura. Lança `CaptureError` em configuração inválida, vídeo ausente,
 * cancelamento ou estouro de limites de tamanho.
 */
export async function captureFrames(
    video: HTMLVideoElement | null,
    config: CaptureConfig = DEFAULT_CAPTURE_CONFIG,
    deps: CaptureDeps = defaultCaptureDeps(),
    signal?: AbortSignal,
): Promise<CapturedFrame[]> {
    validateConfig(config)

    if (!video) {
        throw new CaptureError(
            'no_video',
            'A câmera não está ativa. Ative a câmera antes de capturar.',
        )
    }
    if (signal?.aborted) {
        throw new CaptureError('aborted', 'Captura cancelada.')
    }

    const canvas = deps.createCanvas(config.width, config.height)
    const context = canvas.getContext('2d')
    if (!context) {
        throw new CaptureError(
            'encode_failed',
            'Não foi possível preparar o canvas para capturar os frames.',
        )
    }

    // Intervalo entre frames: distribui frameCount frames na janela.
    const interval =
        config.frameCount > 1
            ? config.windowMs / (config.frameCount - 1)
            : 0

    const frames: CapturedFrame[] = []
    const start = deps.now()
    let totalBytes = 0

    for (let i = 0; i < config.frameCount; i += 1) {
        if (signal?.aborted) {
            throw new CaptureError('aborted', 'Captura cancelada.')
        }
        if (i > 0 && interval > 0) {
            await deps.sleep(interval, signal)
        }

        const timestampMs = Math.round(deps.now() - start)
        context.drawImage(video, 0, 0, config.width, config.height)

        let dataUrl: string
        try {
            dataUrl = canvas.toDataURL('image/jpeg', config.quality)
        } catch {
            throw new CaptureError(
                'encode_failed',
                'Falha ao codificar o frame em JPEG.',
            )
        }

        const data = stripDataUrlPrefix(dataUrl)
        const bytes = base64Bytes(data)
        if (bytes > CAPTURE_LIMITS.maxFrameBytes) {
            throw new CaptureError(
                'frame_too_large',
                'Um frame excedeu o tamanho máximo permitido. Reduza a resolução ou a qualidade.',
            )
        }
        totalBytes += bytes
        if (totalBytes > CAPTURE_LIMITS.maxTotalBytes) {
            throw new CaptureError(
                'total_too_large',
                'O tamanho total dos frames excedeu o limite permitido. Reduza a quantidade de frames, a resolução ou a qualidade.',
            )
        }

        frames.push({ timestampMs, mimeType: 'image/jpeg', data })
    }

    return frames
}
