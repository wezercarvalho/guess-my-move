/**
 * Schema da carta (Zod). Fonte única do contrato: os tipos `Card`,
 * `CardPublic` e `CardEvaluation` são derivados daqui. `public` é o que o
 * jogador vê; `evaluation` (o critério do gesto) NUNCA vai ao jogador nem a
 * uma IA jogadora. Os objetos são estritos, então um campo inesperado invalida
 * a carta.
 */
import * as z from 'zod/mini'

import { nonEmptyText, positiveInt, positiveNumber, ptBR, strict, text } from './builders.js'

/** Parte pública da carta: o que o jogador vê. */
export const cardPublicSchema = strict({
    word: nonEmptyText(),
    hint: nonEmptyText(),
    suggestion: nonEmptyText(),
    difficulty: z.exactOptional(text()),
})

/**
 * Critério de oscilação do ângulo da mão: o gesto é reconhecido quando, dentro
 * de uma janela de `windowMs`, há ao menos `minSamples` amostras e o ângulo
 * inverte de direção `minReversals` vezes, cada meia oscilação com ao menos
 * `amplitudeDeg` graus. É o único critério necessário ao Acenar; novos
 * critérios entram quando houver nova carta que os exija.
 */
export const handAngleOscillationCriterionSchema = strict({
    kind: z.literal('hand-angle-oscillation', { error: ptBR }),
    amplitudeDeg: positiveNumber(),
    minReversals: positiveInt(),
    windowMs: positiveNumber(),
    minSamples: positiveInt(),
})

/** Avaliação privada da carta: o critério que o árbitro por visão aplica. */
export const cardEvaluationSchema = strict({
    criterion: handAngleOscillationCriterionSchema,
})

/** Carta completa: identidade, locale, parte pública e avaliação privada. */
export const cardSchema = strict({
    id: nonEmptyText(),
    locale: nonEmptyText(),
    public: cardPublicSchema,
    evaluation: cardEvaluationSchema,
})

export type CardPublic = z.infer<typeof cardPublicSchema>
export type HandAngleOscillationCriterion = z.infer<
    typeof handAngleOscillationCriterionSchema
>
export type CardEvaluation = z.infer<typeof cardEvaluationSchema>
export type Card = z.infer<typeof cardSchema>
