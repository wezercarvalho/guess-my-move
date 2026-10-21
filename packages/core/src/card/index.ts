/**
 * Módulo da carta: schema/validação, projeção pública (fronteira de
 * informação), carta Acenar e o baralho versionado.
 */
export type { ValidationResult } from './schema.js'
export { isCard, parseCard, validateCard } from './schema.js'
export type { CardPublicProjection } from './public.js'
export { toPublicCard } from './public.js'
export { acenarCard } from './acenar.js'
export { cards, getCardById } from './deck.js'
