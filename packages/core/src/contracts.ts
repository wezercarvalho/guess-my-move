/**
 * Contratos compartilhados da PoC Guess My Move.
 *
 * Os tipos de dados (carta, frames, requisição, resposta e erro) são derivados
 * dos schemas Zod em `schemas/`, a fonte única de verdade; aqui ficam só os
 * re-exports e as interfaces de comportamento (sem lógica, sem I/O). A
 * fronteira de informação é inviolável: a IA adivinhadora nunca recebe a carta
 * — nem palavra, dica, sugestão, aliases ou critérios.
 */
import type { GuesserInput, GuesserResult } from './schemas/index.js'

export type {
    ApiError,
    ApiErrorCode,
    CapturedFrame,
    Card,
    CardEvaluation,
    CardPublic,
    GuessResponse,
    GuesserInput,
    GuesserResult,
} from './schemas/index.js'

/**
 * Adaptador de um provedor de adivinhação. Cada provedor (mock, codex, ...) é
 * selecionado por configuração e implementa este contrato.
 */
export interface GuesserProvider {
    readonly id: string
    guess(input: GuesserInput, signal?: AbortSignal): Promise<GuesserResult>
}
