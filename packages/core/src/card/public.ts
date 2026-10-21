/**
 * Projeção pública da carta: tudo o que o jogador pode ver, nunca a avaliação.
 * A fronteira de informação é inviolável — nenhum dado de `evaluation` (resposta
 * canônica, aliases, palpites insuficientes, critérios visuais) aparece aqui.
 */
import type { Card, CardPublic } from '../contracts.js'

/** Carta sem a avaliação: identidade, locale e parte pública. */
export interface CardPublicProjection {
    id: string
    locale: string
    public: CardPublic
}

/**
 * Deriva a projeção pública de uma carta. NUNCA inclui `evaluation`. Devolve
 * cópias profundas das partes públicas para que o chamador não possa mutar a
 * carta de origem por referência.
 */
export function toPublicCard(card: Card): CardPublicProjection {
    const cardPublic: CardPublic = {
        word: card.public.word,
        hint: card.public.hint,
        suggestion: card.public.suggestion,
        ...(card.public.difficulty !== undefined
            ? { difficulty: card.public.difficulty }
            : {}),
    }
    return {
        id: card.id,
        locale: card.locale,
        public: cardPublic,
    }
}
