/**
 * Tipos da máquina de estados da rodada. Puro e sem I/O: o relógio e o
 * provedor de adivinhação são injetados.
 */
import type { Card, CapturedFrame, GuesserProvider } from '../contracts.js'
import type { AmbiguityResolver, RefereeResult } from '../referee/index.js'

/**
 * Estados da rodada. Fluxo feliz:
 * `idle → card_revealed → camera_ready → capturing → guessing → judging →
 * (correct | retry | finished)`. Estados de exceção são terminais ou
 * recuperáveis conforme a natureza do erro.
 */
export type RoundState =
    | 'idle'
    | 'card_revealed'
    | 'camera_ready'
    | 'capturing'
    | 'guessing'
    | 'judging'
    | 'correct'
    | 'retry'
    | 'finished'
    | 'camera_denied'
    | 'request_timeout'
    | 'provider_error'
    | 'invalid_model_response'
    | 'user_cancelled'

/** Uma entrada do histórico de tentativas, só em memória. */
export interface RoundAttempt {
    guess: string
    result: RefereeResult
    at: number
}

/** Resultado de uma tentativa de palpite. */
export interface AttemptOutcome {
    isCorrect: boolean
    result: RefereeResult
    state: RoundState
    reason?: string
}

/** Relógio injetável; devolve o tempo em milissegundos. */
export type Clock = () => number

/** Configuração e dependências de uma rodada. */
export interface RoundConfig {
    card: Card
    provider: GuesserProvider
    /** Máximo de tentativas de palpite na rodada (>= 1). */
    maxAttempts: number
    /** Duração máxima da rodada em ms (opcional; sem limite quando ausente). */
    maxDurationMs?: number
    /** Timeout por chamada ao provedor em ms (opcional). */
    requestTimeoutMs?: number
    /** Relógio injetável (padrão: Date.now). */
    clock?: Clock
    /** Fallback opcional por LLM do árbitro (desligado por padrão). */
    resolver?: AmbiguityResolver
}

/** API pública da rodada. */
export interface Round {
    readonly state: RoundState
    readonly finished: boolean
    readonly attempts: number
    readonly history: readonly RoundAttempt[]
    readonly rejectedGuesses: readonly string[]
    revealCard(): void
    cameraReady(): void
    denyCamera(): void
    cancel(): void
    attempt(frames: CapturedFrame[]): Promise<AttemptOutcome>
}
