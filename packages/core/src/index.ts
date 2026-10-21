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

// Árbitro semântico determinístico (#13).
export type { RefereeMethod, RefereeResult } from './referee/index.js'
export { judge, normalize } from './referee/index.js'

// Fallback opcional por LLM do árbitro (#14).
export type {
    AmbiguityResolver,
    AmbiguityResolverInput,
    AmbiguityResolverResult,
    JudgeOptions,
} from './referee/index.js'
export { judgeWithFallback } from './referee/index.js'

// Motor da rodada: máquina de estados pura e determinística (#12).
export type {
    AttemptOutcome,
    Clock,
    Round,
    RoundAttempt,
    RoundConfig,
    RoundState,
} from './round/index.js'
export { createRound } from './round/index.js'

// Histórico de palpites rejeitados do modelo, em memória (#15).
export { RejectedGuesses } from './guesser/index.js'
