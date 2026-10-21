import { useCallback, useRef, useState } from 'react'

import {
    captureFrames,
    type CaptureConfig,
    type CaptureDeps,
    DEFAULT_CAPTURE_CONFIG,
} from '../capture/frameCapture.js'
import {
    type GuessClientOptions,
    GuessApiError,
    type GuessResponse,
    requestGuess,
} from './guessClient.js'

/**
 * Estados da tentativa, diferenciados e anunciados na UI:
 * - `idle`: pronto para capturar.
 * - `capturing`: coletando frames da câmera.
 * - `processing`: aguardando o palpite do servidor.
 * - `success`: palpite recebido.
 * - `error`: falha recuperável (a câmera continua utilizável).
 */
export type AttemptPhase =
    | 'idle'
    | 'capturing'
    | 'processing'
    | 'success'
    | 'error'

/** Resultado de sucesso, com a duração exibível. */
export interface AttemptSuccess {
    guess: string
    insufficientEvidence: boolean
    /** Duração da tentativa em ms: da resposta, ou medida no cliente. */
    durationMs: number
}

/** Dependências injetáveis para teste. */
export interface GuessFlowDeps {
    captureDeps?: CaptureDeps
    clientOptions?: GuessClientOptions
    captureConfig?: CaptureConfig
    now?: () => number
}

export interface UseGuessFlowResult {
    phase: AttemptPhase
    result: AttemptSuccess | null
    errorMessage: string | null
    /** Captura e adivinha a partir do `<video>` informado. */
    captureAndGuess: (video: HTMLVideoElement | null) => Promise<void>
    /** Cancela a tentativa em andamento. */
    cancel: () => void
    /** Limpa o resultado/erro e volta a `idle` (Tentar novamente). */
    reset: () => void
}

/**
 * Orquestra uma tentativa: captura os frames, envia ao servidor e expõe o
 * palpite. Os frames são locais e descartados ao fim de cada tentativa (não há
 * estado que os retenha). Erros são recuperáveis: a câmera permanece utilizável
 * e o usuário pode tentar de novo.
 */
export function useGuessFlow(deps: GuessFlowDeps = {}): UseGuessFlowResult {
    const [phase, setPhase] = useState<AttemptPhase>('idle')
    const [result, setResult] = useState<AttemptSuccess | null>(null)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const abortRef = useRef<AbortController | null>(null)

    // `now` estável entre renders: a dependência injetada (ou o relógio padrão)
    // é fixada na primeira renderização.
    const nowRef = useRef<() => number>(
        deps.now ??
            (() =>
                typeof performance !== 'undefined'
                    ? performance.now()
                    : Date.now()),
    )
    const now = nowRef.current

    const cancel = useCallback(() => {
        abortRef.current?.abort()
        abortRef.current = null
    }, [])

    const reset = useCallback(() => {
        cancel()
        setPhase('idle')
        setResult(null)
        setErrorMessage(null)
    }, [cancel])

    const captureAndGuess = useCallback(
        async (video: HTMLVideoElement | null) => {
            const controller = new AbortController()
            abortRef.current = controller
            setResult(null)
            setErrorMessage(null)
            setPhase('capturing')

            const started = now()
            // `frames` é uma variável local: sai de escopo ao fim da tentativa,
            // sem persistência nem retenção global.
            let frames
            try {
                frames = await captureFrames(
                    video,
                    deps.captureConfig ?? DEFAULT_CAPTURE_CONFIG,
                    deps.captureDeps,
                    controller.signal,
                )
            } catch (error) {
                if (controller.signal.aborted) {
                    setPhase('idle')
                } else {
                    setPhase('error')
                    setErrorMessage(captureErrorMessage(error))
                }
                abortRef.current = null
                return
            }

            setPhase('processing')
            let response: GuessResponse
            try {
                response = await requestGuess(
                    { frames },
                    deps.clientOptions,
                    controller.signal,
                )
            } catch (error) {
                abortRef.current = null
                if (error instanceof GuessApiError && error.code === 'aborted') {
                    setPhase('idle')
                    return
                }
                setPhase('error')
                setErrorMessage(
                    error instanceof GuessApiError
                        ? error.message
                        : 'Falha inesperada ao obter o palpite. Tente novamente.',
                )
                return
            }
            // Os frames são uma variável local da tentativa: saem de escopo
            // ao fim desta função, sem persistência nem retenção global.

            abortRef.current = null
            setResult({
                guess: response.guess,
                insufficientEvidence: response.insufficientEvidence ?? false,
                // Prefere a duração do servidor; cai para a medição no cliente.
                durationMs:
                    typeof response.durationMs === 'number'
                        ? response.durationMs
                        : Math.round(now() - started),
            })
            setPhase('success')
        },
        [deps.captureConfig, deps.captureDeps, deps.clientOptions, now],
    )

    return { phase, result, errorMessage, captureAndGuess, cancel, reset }
}

/** Mensagem legível para erros de captura. */
function captureErrorMessage(error: unknown): string {
    if (
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof error.message === 'string'
    ) {
        return error.message
    }
    return 'Não foi possível capturar os frames. Tente novamente.'
}
