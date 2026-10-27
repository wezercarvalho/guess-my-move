/**
 * API pública do pacote `@guess-my-move/core`.
 *
 * Contratos compartilhados (tipos) vivem em `contracts.ts`; a implementação é
 * organizada por domínio (`card/`, `gesture/`, `round/`). Tudo aqui é puro:
 * sem DOM, sem câmera e sem MediaPipe. A fronteira de informação é inviolável:
 * o jogador e uma IA jogadora futura nunca recebem a avaliação da carta.
 */

// Contratos compartilhados: tipos derivados dos schemas.
export type {
    Card,
    CardEvaluation,
    CardPublic,
    HandAngleOscillationCriterion,
} from './contracts.js'

// Schemas Zod: fonte única do contrato da carta.
export {
    cardEvaluationSchema,
    cardPublicSchema,
    cardSchema,
    handAngleOscillationCriterionSchema,
} from './schemas/index.js'

// Carta: schema/validação, projeção pública e baralho versionado.
export type { CardPublicProjection, ValidationResult } from './card/index.js'
export {
    acenarCard,
    cards,
    getCardById,
    isCard,
    parseCard,
    toPublicCard,
    validateCard,
} from './card/index.js'

// Gesto: ângulo da mão e avaliador da oscilação.
export type { HandLandmark, HandSample, OscillationVerdict } from './gesture/index.js'
export { evaluateOscillation, handAngleDeg } from './gesture/index.js'

// Motor da rodada: máquina de estados pura e determinística.
export type { Clock, Round, RoundConfig, RoundState } from './round/index.js'
export { createRound, DEFAULT_MAX_DURATION_MS } from './round/index.js'
