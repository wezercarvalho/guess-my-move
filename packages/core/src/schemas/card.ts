/**
 * Schema da carta (Zod). Fonte única do contrato: os tipos `Card`,
 * `CardPublic` e `CardEvaluation` são derivados daqui. `public` é o que o
 * jogador vê; `evaluation` NUNCA sai do servidor/motor nem vai ao adivinhador.
 * Os objetos são estritos, então um campo inesperado invalida a carta.
 */
import * as z from 'zod/mini'

import { nonEmptyText, strict, text, textList } from './builders.js'

/** Parte pública da carta: o que o jogador vê. */
export const cardPublicSchema = strict({
    word: nonEmptyText(),
    hint: nonEmptyText(),
    suggestion: nonEmptyText(),
    difficulty: z.exactOptional(text()),
})

/**
 * Metadados de avaliação: resposta canônica, aliases aceitos, palpites
 * insuficientes, palpites ambíguos (decididos pelo fallback opcional por LLM) e
 * critérios visuais futuros.
 */
export const cardEvaluationSchema = strict({
    canonicalAnswer: nonEmptyText(),
    acceptedAliases: textList(),
    insufficientGuesses: textList(),
    ambiguousGuesses: z.exactOptional(textList()),
    visualCriteria: z.exactOptional(textList()),
})

/** Carta completa: identidade, locale, parte pública e avaliação privada. */
export const cardSchema = strict({
    id: nonEmptyText(),
    locale: nonEmptyText(),
    public: cardPublicSchema,
    evaluation: cardEvaluationSchema,
})

export type CardPublic = z.infer<typeof cardPublicSchema>
export type CardEvaluation = z.infer<typeof cardEvaluationSchema>
export type Card = z.infer<typeof cardSchema>
