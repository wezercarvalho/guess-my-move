/**
 * API pública do pacote `@guess-my-move/core`.
 *
 * Contratos compartilhados (tipos) vivem em `contracts.ts`; a implementação é
 * organizada por domínio (`card/`, `referee/`, `round/`, `guesser/`). A
 * fronteira de informação é inviolável: a IA adivinhadora nunca recebe a carta
 * — nem palavra, dica, sugestão, aliases ou critérios.
 *
 * Mantenha esta API compatível com os contratos já exportados: apenas adicione.
 */

// Contratos compartilhados (tipos, sem lógica).
export type {
    ApiError,
    ApiErrorCode,
    Card,
    CardEvaluation,
    CardPublic,
    CapturedFrame,
    GuesserInput,
    GuesserProvider,
    GuesserResult,
} from './contracts.js'

// Carta: schema/validação, projeção pública e baralho versionado (#11).
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
