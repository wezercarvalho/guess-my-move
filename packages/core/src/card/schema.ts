/**
 * Validação de schema da carta em código próprio (sem dependência de banco nem
 * de biblioteca externa). Mantém o núcleo sem I/O e determinístico.
 *
 * A carta separa `public` (o que o jogador vê) de `evaluation` (resposta
 * canônica, aliases e palpites insuficientes), e a validação garante que ambas
 * as partes estejam bem formadas antes de a carta entrar no jogo.
 */
import type { Card, CardEvaluation, CardPublic } from '../contracts.js'

/** Resultado de validação: sucesso tipado ou lista de erros legíveis. */
export type ValidationResult =
    | { ok: true; card: Card }
    | { ok: false; errors: string[] }

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0
}

function isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((v) => typeof v === 'string')
}

function validatePublic(value: unknown, errors: string[]): void {
    if (!isObject(value)) {
        errors.push('public: deve ser um objeto')
        return
    }
    if (!isNonEmptyString(value['word'])) {
        errors.push('public.word: string não vazia obrigatória')
    }
    if (!isNonEmptyString(value['hint'])) {
        errors.push('public.hint: string não vazia obrigatória')
    }
    if (!isNonEmptyString(value['suggestion'])) {
        errors.push('public.suggestion: string não vazia obrigatória')
    }
    if (
        value['difficulty'] !== undefined &&
        typeof value['difficulty'] !== 'string'
    ) {
        errors.push('public.difficulty: string quando presente')
    }
}

function validateEvaluation(value: unknown, errors: string[]): void {
    if (!isObject(value)) {
        errors.push('evaluation: deve ser um objeto')
        return
    }
    if (!isNonEmptyString(value['canonicalAnswer'])) {
        errors.push('evaluation.canonicalAnswer: string não vazia obrigatória')
    }
    if (!isStringArray(value['acceptedAliases'])) {
        errors.push('evaluation.acceptedAliases: array de strings obrigatório')
    }
    if (!isStringArray(value['insufficientGuesses'])) {
        errors.push(
            'evaluation.insufficientGuesses: array de strings obrigatório',
        )
    }
    if (
        value['visualCriteria'] !== undefined &&
        !isStringArray(value['visualCriteria'])
    ) {
        errors.push('evaluation.visualCriteria: array de strings quando presente')
    }
    if (
        value['ambiguousGuesses'] !== undefined &&
        !isStringArray(value['ambiguousGuesses'])
    ) {
        errors.push(
            'evaluation.ambiguousGuesses: array de strings quando presente',
        )
    }
}

/**
 * Valida uma carta arbitrária contra o schema. Nunca lança: devolve o
 * resultado tipado para o chamador decidir o que fazer.
 */
export function validateCard(value: unknown): ValidationResult {
    const errors: string[] = []

    if (!isObject(value)) {
        return { ok: false, errors: ['carta: deve ser um objeto'] }
    }
    if (!isNonEmptyString(value['id'])) {
        errors.push('id: string não vazia obrigatória')
    }
    if (!isNonEmptyString(value['locale'])) {
        errors.push('locale: string não vazia obrigatória')
    }
    validatePublic(value['public'], errors)
    validateEvaluation(value['evaluation'], errors)

    if (errors.length > 0) {
        return { ok: false, errors }
    }

    const obj = value
    const pub = obj['public'] as Record<string, unknown>
    const evaluation = obj['evaluation'] as Record<string, unknown>

    const cardPublic: CardPublic = {
        word: pub['word'] as string,
        hint: pub['hint'] as string,
        suggestion: pub['suggestion'] as string,
        ...(typeof pub['difficulty'] === 'string'
            ? { difficulty: pub['difficulty'] }
            : {}),
    }

    const cardEvaluation: CardEvaluation = {
        canonicalAnswer: evaluation['canonicalAnswer'] as string,
        acceptedAliases: [...(evaluation['acceptedAliases'] as string[])],
        insufficientGuesses: [
            ...(evaluation['insufficientGuesses'] as string[]),
        ],
        ...(isStringArray(evaluation['ambiguousGuesses'])
            ? { ambiguousGuesses: [...evaluation['ambiguousGuesses']] }
            : {}),
        ...(isStringArray(evaluation['visualCriteria'])
            ? { visualCriteria: [...evaluation['visualCriteria']] }
            : {}),
    }

    const card: Card = {
        id: obj['id'] as string,
        locale: obj['locale'] as string,
        public: cardPublic,
        evaluation: cardEvaluation,
    }

    return { ok: true, card }
}

/** Type guard: verdadeiro quando o valor é uma carta válida. */
export function isCard(value: unknown): value is Card {
    return validateCard(value).ok
}

/**
 * Valida e devolve a carta tipada, lançando com a lista de erros quando o
 * valor não for uma carta válida. Útil ao carregar cartas versionadas.
 */
export function parseCard(value: unknown): Card {
    const result = validateCard(value)
    if (!result.ok) {
        throw new Error(`Carta inválida: ${result.errors.join('; ')}`)
    }
    return result.card
}
