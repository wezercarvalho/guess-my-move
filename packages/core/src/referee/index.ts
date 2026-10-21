/** Módulo do árbitro semântico: normalização, tipos e veredito determinístico. */
export { normalize } from './normalize.js'
export type { RefereeMethod, RefereeResult } from './types.js'
export { judge } from './judge.js'
export type {
    AmbiguityResolver,
    AmbiguityResolverInput,
    AmbiguityResolverResult,
    JudgeOptions,
} from './fallback.js'
export { judgeWithFallback } from './fallback.js'
