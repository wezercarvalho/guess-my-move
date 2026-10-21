/**
 * Baralho em memória: lista de cartas versionadas e busca por id. Adicionar
 * uma carta é só incluí-la em `cards`; nada no motor precisa mudar.
 */
import type { Card } from '../contracts.js'
import { acenarCard } from './acenar.js'

/** Todas as cartas disponíveis no jogo. Imutável em runtime. */
export const cards: readonly Card[] = Object.freeze([acenarCard])

/** Busca uma carta pelo id; `undefined` quando não existe. */
export function getCardById(id: string): Card | undefined {
    return cards.find((card) => card.id === id)
}
