import { type CardPublicProjection } from '@guess-my-move/core'

/**
 * Exibe SOMENTE a parte pública da carta (`CardPublicProjection`): palavra,
 * dica e sugestão. A avaliação (resposta canônica, aliases, critérios) nunca é
 * recebida por este componente — o tipo `CardPublicProjection` não a contém.
 */
export interface CardViewProps {
    card: CardPublicProjection
}

export function CardView({ card }: CardViewProps) {
    return (
        <section aria-labelledby="card-heading" className="card-view">
            <h2 id="card-heading">Sua carta</h2>
            <p className="card-word">{card.public.word}</p>
            <dl className="card-details">
                <div>
                    <dt>Dica</dt>
                    <dd>{card.public.hint}</dd>
                </div>
                <div>
                    <dt>Sugestão</dt>
                    <dd>{card.public.suggestion}</dd>
                </div>
            </dl>
        </section>
    )
}
