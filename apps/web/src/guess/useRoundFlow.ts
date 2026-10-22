import {
    type CapturedFrame,
    type Card,
    createRound,
    type GuesserInput,
    type GuesserProvider,
    type GuesserResult,
    type Round,
} from '@guess-my-move/core'
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
    requestGuess,
} from './guessClient.js'

/** Limite padrão de tentativas válidas por rodada. */
export const DEFAULT_MAX_ATTEMPTS = 3

/**
 * Estados da tentativa, diferenciados e anunciados na UI:
 * - `idle`: pronto para capturar.
 * - `capturing`: coletando frames da câmera.
 * - `processing`: aguardando o palpite do servidor.
 * - `result`: palpite recebido e julgado (acerto, nova tentativa ou fim).
 * - `error`: falha recuperável (a câmera continua utilizável e a tentativa
 *   não é consumida).
 */
export type AttemptPhase =
    | 'idle'
    | 'capturing'
    | 'processing'
    | 'result'
    | 'error'

/**
 * Resultado da última tentativa:
 * - `correct`: o árbitro aceitou o palpite; a rodada acabou;
 * - `retry`: palpite rejeitado, ainda há tentativas;
 * - `finished`: palpite rejeitado e as tentativas acabaram;
 * - `insufficient`: o provedor não teve evidência; a tentativa não é consumida.
 */
export type AttemptVerdict = 'correct' | 'retry' | 'finished' | 'insufficient'

/** Última tentativa, com a duração exibível. */
export interface AttemptResult {
    verdict: AttemptVerdict
    guess: string
    /** Duração da tentativa em ms: da resposta, ou medida no cliente. */
    durationMs: number
}

/** Visão imutável da rodada para a interface. */
export interface RoundView {
    /** Tentativas válidas já julgadas (não conta erro recuperável). */
    attempts: number
    maxAttempts: number
    /** Palpites da IA já rejeitados, na ordem. */
    rejectedGuesses: readonly string[]
    /** `true` quando acertou ou esgotou as tentativas. */
    finished: boolean
    /** Incrementa a cada nova rodada; serve de `key` para zerar estado local. */
    roundNumber: number
}

/** Dependências injetáveis para teste. */
export interface GuessFlowDeps {
    captureDeps?: CaptureDeps
    clientOptions?: GuessClientOptions
    captureConfig?: CaptureConfig
    now?: () => number
}

export interface UseRoundFlowResult {
    phase: AttemptPhase
    result: AttemptResult | null
    errorMessage: string | null
    round: RoundView
    /** Captura e adivinha a partir do `<video>` informado. */
    captureAndGuess: (video: HTMLVideoElement | null) => Promise<void>
    /** Cancela a tentativa em andamento. */
    cancel: () => void
    /** Limpa o erro e volta a `idle` (Tentar novamente). */
    reset: () => void
    /** Descarta a rodada atual e começa outra, sem histórico. */
    newRound: () => void
}

/**
 * Fonte do `AbortSignal` da tentativa em andamento. É uma classe (e não um
 * `ref`) para que o adaptador HTTP leia o sinal vigente no momento da chamada,
 * e não na renderização.
 */
class AttemptSignal {
    private controller: AbortController | null = null

    /** Inicia uma tentativa e devolve o controlador novo. */
    begin(): AbortController {
        this.controller = new AbortController()
        return this.controller
    }

    get signal(): AbortSignal | undefined {
        return this.controller?.signal
    }

    abort(): void {
        this.controller?.abort()
        this.controller = null
    }

    clear(): void {
        this.controller = null
    }
}

/** Última resposta ou falha do cliente HTTP, lida pelo hook após cada tentativa. */
interface ClientTrace {
    durationMs: number | undefined
    error: GuessApiError | undefined
}

/**
 * Adaptador do cliente HTTP como `GuesserProvider` do motor. Registra a
 * duração e o erro do cliente para a interface mostrar a mensagem legível.
 * Envia só frames e `rejectedGuesses`: o motor nunca passa dados da carta.
 */
function createHttpGuesser(
    trace: ClientTrace,
    getSignal: () => AbortSignal | undefined,
    options: GuessClientOptions | undefined,
): GuesserProvider {
    return {
        id: 'http',
        async guess(input: GuesserInput): Promise<GuesserResult> {
            trace.durationMs = undefined
            trace.error = undefined
            try {
                const response = await requestGuess(
                    input,
                    options,
                    getSignal(),
                )
                trace.durationMs = response.durationMs
                return {
                    guess: response.guess,
                    ...(response.insufficientEvidence === true
                        ? { insufficientEvidence: true }
                        : {}),
                }
            } catch (error) {
                if (error instanceof GuessApiError) {
                    trace.error = error
                }
                throw error
            }
        },
    }
}

function lastGuess(round: Round): string {
    return round.history[round.history.length - 1]?.guess ?? ''
}

function viewOf(
    round: Round,
    maxAttempts: number,
    roundNumber: number,
): RoundView {
    return {
        attempts: round.attempts,
        maxAttempts,
        rejectedGuesses: [...round.rejectedGuesses],
        finished: round.finished,
        roundNumber,
    }
}

/**
 * Conduz uma rodada completa: captura os frames, envia ao servidor, deixa o
 * motor (`createRound`) e o árbitro julgarem e expõe o veredito. Os frames são
 * locais e descartados ao fim de cada tentativa (não há estado que os retenha).
 * Erros recuperáveis não consomem tentativa e a câmera permanece utilizável.
 *
 * O julgamento ocorre no cliente, como prevê a spec da PoC: a avaliação da
 * carta já está no bundle, o que é um limite conhecido, não uma proteção
 * antifraude. A fronteira do adivinhador não muda: ele nunca recebe a carta.
 */
export function useRoundFlow(
    card: Card,
    deps: GuessFlowDeps = {},
    maxAttempts: number = DEFAULT_MAX_ATTEMPTS,
): UseRoundFlowResult {
    const [phase, setPhase] = useState<AttemptPhase>('idle')
    const [result, setResult] = useState<AttemptResult | null>(null)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [attemptSignal] = useState(() => new AttemptSignal())
    // Rodada cujo resultado ainda vale: uma tentativa que termina depois de
    // "Nova rodada" não pode escrever na rodada nova.
    const activeEngineRef = useRef<Round | null>(null)
    const [trace] = useState<ClientTrace>(() => ({
        durationMs: undefined,
        error: undefined,
    }))

    // `now` estável entre renders: a dependência injetada (ou o relógio padrão)
    // é fixada na primeira renderização.
    const [now] = useState<() => number>(
        () =>
            deps.now ??
            (() =>
                typeof performance !== 'undefined'
                    ? performance.now()
                    : Date.now()),
    )

    const buildRound = useCallback((): Round => {
        const engine = createRound({
            card,
            provider: createHttpGuesser(
                trace,
                () => attemptSignal.signal,
                deps.clientOptions,
            ),
            maxAttempts,
        })
        engine.revealCard()
        return engine
    }, [attemptSignal, card, deps.clientOptions, maxAttempts, trace])

    // O motor é mutável; a visão (`view`) é o espelho imutável que a tela lê.
    const [session, setSession] = useState(() => {
        const engine = buildRound()
        return { engine, view: viewOf(engine, maxAttempts, 1) }
    })

    const cancel = useCallback(() => {
        attemptSignal.abort()
    }, [attemptSignal])

    const reset = useCallback(() => {
        cancel()
        setPhase('idle')
        setResult(null)
        setErrorMessage(null)
    }, [cancel])

    const newRound = useCallback(() => {
        cancel()
        activeEngineRef.current = null
        const engine = buildRound()
        setSession((previous) => ({
            engine,
            view: viewOf(engine, maxAttempts, previous.view.roundNumber + 1),
        }))
        setPhase('idle')
        setResult(null)
        setErrorMessage(null)
    }, [buildRound, cancel, maxAttempts])

    const captureAndGuess = useCallback(
        async (video: HTMLVideoElement | null) => {
            const { engine } = session
            if (engine.finished) {
                return
            }
            activeEngineRef.current = engine
            const controller = attemptSignal.begin()
            setResult(null)
            setErrorMessage(null)
            setPhase('capturing')

            const started = now()
            // `frames` é uma variável local: sai de escopo ao fim da tentativa,
            // sem persistência nem retenção global.
            let frames: CapturedFrame[]
            try {
                frames = await captureFrames(
                    video,
                    deps.captureConfig ?? DEFAULT_CAPTURE_CONFIG,
                    deps.captureDeps,
                    controller.signal,
                )
            } catch (error) {
                if (activeEngineRef.current !== engine) {
                    return
                }
                if (controller.signal.aborted) {
                    setPhase('idle')
                } else {
                    setPhase('error')
                    setErrorMessage(captureErrorMessage(error))
                }
                attemptSignal.clear()
                return
            }
            if (activeEngineRef.current !== engine) {
                return
            }

            // A câmera está ativa (a captura funcionou): libera o motor.
            if (engine.state === 'card_revealed') {
                engine.cameraReady()
            }

            setPhase('processing')
            const outcome = await engine.attempt(frames)
            if (activeEngineRef.current !== engine) {
                return
            }
            attemptSignal.clear()

            setSession((previous) =>
                previous.engine === engine
                    ? {
                          engine,
                          view: viewOf(
                              engine,
                              maxAttempts,
                              previous.view.roundNumber,
                          ),
                      }
                    : previous,
            )

            // Falhas do provedor/cliente: recuperáveis, sem consumir tentativa.
            if (
                outcome.state === 'provider_error' ||
                outcome.state === 'request_timeout'
            ) {
                if (trace.error?.code === 'aborted') {
                    setPhase('idle')
                    return
                }
                setPhase('error')
                setErrorMessage(
                    trace.error?.message ??
                        'Falha inesperada ao obter o palpite. Tente novamente.',
                )
                return
            }

            const durationMs = trace.durationMs ?? Math.round(now() - started)

            if (outcome.state === 'invalid_model_response') {
                setResult({ verdict: 'insufficient', guess: '', durationMs })
                setPhase('result')
                return
            }

            const verdict: AttemptVerdict =
                outcome.state === 'correct'
                    ? 'correct'
                    : outcome.state === 'finished'
                      ? 'finished'
                      : 'retry'
            setResult({ verdict, guess: lastGuess(engine), durationMs })
            setPhase('result')
        },
        [
            attemptSignal,
            deps.captureConfig,
            deps.captureDeps,
            maxAttempts,
            now,
            session,
            trace,
        ],
    )

    return {
        phase,
        result,
        errorMessage,
        round: session.view,
        captureAndGuess,
        cancel,
        reset,
        newRound,
    }
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
