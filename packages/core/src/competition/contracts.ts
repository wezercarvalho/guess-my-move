import * as z from 'zod/mini'
import { cardPublicSchema } from '../schemas/card.js'

export const cardLocaleSchema = z.enum(['pt-BR', 'en-US'])
export const publicCardSchema = z.strictObject({
    id: z.string(),
    locale: z.string(),
    public: cardPublicSchema,
})
export const startCardRoundSchema = z.strictObject({
    cardId: z.string().check(z.minLength(1), z.maxLength(80)),
    locale: cardLocaleSchema,
})
export const observeCardRoundSchema = z.strictObject({
    seq: z.int().check(z.minimum(1), z.maximum(Number.MAX_SAFE_INTEGER)),
    angleDeg: z.nullable(z.number().check(z.minimum(-180), z.maximum(180))),
})
export const cancelCardRoundSchema = z.strictObject({})
export const cardRoundSnapshotSchema = z.strictObject({
    card: publicCardSchema,
    state: z.enum(['detecting', 'recognized', 'timed_out', 'user_cancelled']),
    elapsedMs: z.number().check(z.minimum(0)),
    maxDurationMs: z.number().check(z.minimum(1)),
    score: z.int().check(z.minimum(0)),
})
export const cardRoundAccessSchema = z.strictObject({
    roundId: z.string().check(z.uuid()),
    token: z.string().check(z.minLength(32), z.maxLength(128)),
    round: cardRoundSnapshotSchema,
})
export type StartCardRound = z.infer<typeof startCardRoundSchema>
export type ObserveCardRound = z.infer<typeof observeCardRoundSchema>
export type CardRoundSnapshot = z.infer<typeof cardRoundSnapshotSchema>
export type CardRoundAccess = z.infer<typeof cardRoundAccessSchema>
