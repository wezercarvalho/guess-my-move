/**
 * Árbitro semântico determinístico. Compara o palpite com a resposta canônica
 * e os aliases por EQUIVALÊNCIA DE EXPRESSÃO (igualdade da forma normalizada),
 * nunca por substring. Rejeita palpites insuficientes e devolve `undetermined`
 * quando não há material para decidir (palpite vazio/sem conteúdo).
 *
 * O árbitro é puro e determinístico: para a mesma entrada, a mesma saída. O
 * fallback opcional por LLM (#14) é adicionado por cima sem alterar este núcleo.
 */
import type { CardEvaluation } from '../contracts.js'
import { normalize } from './normalize.js'
import type { RefereeResult } from './types.js'

/** Decide o veredito determinístico do palpite contra a avaliação da carta. */
export function judge(
    evaluation: CardEvaluation,
    guess: string,
): RefereeResult {
    const normalizedGuess = normalize(guess)

    // Sem conteúdo após normalizar: dúvida material, nunca acerto.
    if (normalizedGuess === '') {
        return {
            isCorrect: false,
            method: 'undetermined',
            reason: 'palpite vazio ou sem conteúdo após normalização',
        }
    }

    // Equivalência com a resposta canônica.
    if (normalize(evaluation.canonicalAnswer) === normalizedGuess) {
        return {
            isCorrect: true,
            method: 'canonical',
            matchedAnswer: evaluation.canonicalAnswer,
            reason: 'equivalente à resposta canônica',
        }
    }

    // Equivalência com um alias aceito.
    const alias = evaluation.acceptedAliases.find(
        (a) => normalize(a) === normalizedGuess,
    )
    if (alias !== undefined) {
        return {
            isCorrect: true,
            method: 'alias',
            matchedAnswer: alias,
            reason: `equivalente ao alias aceito "${alias}"`,
        }
    }

    // Palpite reconhecidamente insuficiente/genérico.
    const insufficient = evaluation.insufficientGuesses.find(
        (g) => normalize(g) === normalizedGuess,
    )
    if (insufficient !== undefined) {
        return {
            isCorrect: false,
            method: 'insufficient',
            reason: `palpite genérico/insuficiente ("${insufficient}")`,
        }
    }

    // Palpite conhecidamente ambíguo: dúvida material → undetermined. O
    // fallback opcional por LLM (#14) pode decidir por cima de forma
    // conservadora; sem fallback, permanece undetermined (nunca acerto).
    const ambiguous = evaluation.ambiguousGuesses?.find(
        (g) => normalize(g) === normalizedGuess,
    )
    if (ambiguous !== undefined) {
        return {
            isCorrect: false,
            method: 'undetermined',
            reason: `palpite ambíguo ("${ambiguous}") — dúvida material`,
        }
    }

    // Não corresponde a nada conhecido: incorreto, mas não insuficiente.
    return {
        isCorrect: false,
        method: 'none',
        reason: 'não corresponde à resposta canônica nem a um alias',
    }
}
