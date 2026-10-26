/**
 * Validação da carta sobre o schema Zod (`schemas/card.ts`), a fonte única do
 * contrato. Mantém a API pública (`validateCard`, `isCard`, `parseCard`) com
 * mensagens de erro legíveis em português, sem dependência de banco.
 *
 * A carta separa `public` (o que o jogador vê) de `evaluation` (o critério do
 * gesto). O schema é estrito: um campo
 * inesperado invalida a carta, o que protege a fronteira de informação.
 */
import { cardSchema } from '../schemas/card.js'
import type { Card } from '../schemas/card.js'

/** Resultado de validação: sucesso tipado ou lista de erros legíveis. */
export type ValidationResult =
    | { ok: true; card: Card }
    | { ok: false; errors: string[] }

/**
 * Valida uma carta arbitrária contra o schema. Nunca lança: devolve o
 * resultado tipado para o chamador decidir o que fazer. A carta devolvida é uma
 * cópia, independente do objeto de entrada.
 */
export function validateCard(value: unknown): ValidationResult {
    const result = cardSchema.safeParse(value)
    if (result.success) {
        return { ok: true, card: result.data }
    }
    return {
        ok: false,
        errors: result.error.issues.map((issue) => {
            const path = issue.path.map(String).join('.')
            return path ? `${path}: ${issue.message}` : `carta: ${issue.message}`
        }),
    }
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
