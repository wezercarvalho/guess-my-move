/**
 * Tipos da máquina de estados da rodada. Puro e sem I/O: o relógio é injetado e
 * o detector de mão vive fora do núcleo; a rodada só recebe o ângulo da mão.
 */
import type { Card } from '../contracts.js'
import type { OscillationVerdict } from '../gesture/index.js'

/**
 * Estados da rodada. Fluxo feliz:
 * `idle → card_revealed → camera_ready → detecting → (recognized | timed_out)`.
 * Estados de exceção encerram a rodada; uma nova rodada começa em `idle`.
 */
export type RoundState =
    | 'idle'
    | 'card_revealed'
    | 'camera_ready'
    | 'detecting'
    | 'recognized'
    | 'timed_out'
    | 'camera_denied'
    | 'tracker_error'
    | 'user_cancelled'

/** Relógio injetável; devolve o tempo em milissegundos. */
export type Clock = () => number

/** Configuração e dependências de uma rodada. */
export interface RoundConfig {
    card: Card
    /** Duração máxima de `detecting` em ms (padrão: 10 000). */
    maxDurationMs?: number
    /** Relógio injetável (padrão: Date.now). */
    clock?: Clock
}

/** API pública da rodada. */
export interface Round {
    readonly state: RoundState
    readonly finished: boolean
    /** Última avaliação do critério; `null` enquanto não houve amostra. */
    readonly verdict: OscillationVerdict | null
    /** Tempo desde o Começar, em ms; congela ao terminar; `null` antes de começar. */
    readonly elapsedMs: number | null
    /** Motivo da falha do detector, quando o estado é `tracker_error`. */
    readonly failureReason: string | null
    revealCard(): void
    cameraReady(): void
    denyCamera(): void
    trackerFailed(reason: string): void
    start(): void
    /** Registra o ângulo atual da mão; devolve a avaliação ou `null` se ignorado. */
    observe(angleDeg: number): OscillationVerdict | null
    /** Confere o limite de tempo sem nova amostra. */
    tick(): void
    cancel(): void
}
