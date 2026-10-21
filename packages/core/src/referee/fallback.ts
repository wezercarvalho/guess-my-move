/**
 * Fallback opcional por LLM do árbitro (#14). É uma INTERFACE INJETÁVEL,
 * desligada por padrão: o núcleo não acopla nenhum provedor. O árbitro só
 * recorre a ela em ambiguidade (veredito determinístico `undetermined`).
 *
 * Política conservadora (constituição V, NFR-004): qualquer erro ou dúvida
 * material resulta em `undetermined`, NUNCA em um acerto inventado. Um acerto
 * só é aceito quando o resolver responde de forma confiante que o palpite é
 * correto.
 *
 * O resolver arbitra TEXTO, não a webcam: recebe o palpite e os dados textuais
 * de avaliação da carta, nunca frames.
 */
import type { CardEvaluation } from '../contracts.js'
import { judge } from './judge.js'
import type { RefereeResult } from './types.js'

/** Entrada textual passada ao resolver de ambiguidade. */
export interface AmbiguityResolverInput {
    guess: string
    canonicalAnswer: string
    acceptedAliases: string[]
    insufficientGuesses: string[]
}

/** Resposta estruturada do resolver. `confident` é obrigatório e conservador. */
export interface AmbiguityResolverResult {
    isCorrect: boolean
    confident: boolean
    reason?: string
}

/**
 * Interface injetável de fallback. Implementações reais (um LLM de texto) são
 * trabalho futuro fora do núcleo; o núcleo entrega apenas o contrato.
 */
export interface AmbiguityResolver {
    resolve(
        input: AmbiguityResolverInput,
        signal?: AbortSignal,
    ): Promise<AmbiguityResolverResult>
}

/** Opções do julgamento com fallback. */
export interface JudgeOptions {
    /** Resolver injetado. Ausente = fallback desligado (comportamento padrão). */
    resolver?: AmbiguityResolver
    signal?: AbortSignal
}

/**
 * Julga um palpite com fallback opcional. Primeiro aplica o árbitro
 * determinístico; só consulta o resolver quando o veredito é `undetermined` e
 * um resolver foi injetado. Falha ou dúvida do resolver → `undetermined`.
 */
export async function judgeWithFallback(
    evaluation: CardEvaluation,
    guess: string,
    options: JudgeOptions = {},
): Promise<RefereeResult> {
    const deterministic = judge(evaluation, guess)

    // Só ambiguidade material aciona o fallback; vereditos claros passam direto.
    if (deterministic.method !== 'undetermined') {
        return deterministic
    }

    const { resolver } = options
    if (resolver === undefined) {
        return deterministic
    }

    const input: AmbiguityResolverInput = {
        guess,
        canonicalAnswer: evaluation.canonicalAnswer,
        acceptedAliases: [...evaluation.acceptedAliases],
        insufficientGuesses: [...evaluation.insufficientGuesses],
    }

    let resolved: AmbiguityResolverResult
    try {
        resolved = await resolver.resolve(input, options.signal)
    } catch (error) {
        const detail = error instanceof Error ? error.message : 'erro'
        return {
            isCorrect: false,
            method: 'undetermined',
            reason: `fallback por LLM falhou (${detail}) — mantido undetermined`,
        }
    }

    // Só acerto quando o resolver é confiante E afirma correto.
    if (resolved.confident && resolved.isCorrect) {
        return {
            isCorrect: true,
            method: 'llm',
            reason: resolved.reason ?? 'fallback por LLM confirmou equivalência',
        }
    }

    // Qualquer outro caso (não confiante, confiante-incorreto) é conservador.
    return {
        isCorrect: false,
        method: 'undetermined',
        reason:
            resolved.reason ??
            'fallback por LLM sem confiança suficiente — mantido undetermined',
    }
}
