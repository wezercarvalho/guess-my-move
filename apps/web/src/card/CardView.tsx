import { type CardPublicProjection } from '@guess-my-move/core'
import { useId, useState } from 'react'

/** Itens da carta que ficam ocultos até o jogador pedir. */
export type RevealableItem = 'hint' | 'suggestion'

/**
 * Exibe SOMENTE a parte pública da carta (`CardPublicProjection`): palavra,
 * dica e sugestão. A avaliação (o critério do gesto) nunca é
 * recebida por este componente — o tipo `CardPublicProjection` não a contém.
 *
 * A dica e a sugestão ficam ocultas (fora do DOM) por padrão e são reveladas
 * de forma independente, sob ação explícita. `onReveal` é chamado só ao
 * revelar e serve de ponto de extensão para a pontuação futura; a revelação é
 * estado local da tela.
 */
export interface CardViewProps {
    card: CardPublicProjection
    onReveal?: ((item: RevealableItem) => void) | undefined
}

export function CardView({ card, onReveal }: CardViewProps) {
    // `key` por carta: ao trocar de carta, o estado de revelação recomeça oculto.
    return <CardContent key={card.id} card={card} onReveal={onReveal} />
}

function CardContent({ card, onReveal }: CardViewProps) {
    const [revealed, setRevealed] = useState<Record<RevealableItem, boolean>>({
        hint: false,
        suggestion: false,
    })

    const toggle = (item: RevealableItem) => {
        const willReveal = !revealed[item]
        setRevealed((current) => ({ ...current, [item]: willReveal }))
        if (willReveal) {
            onReveal?.(item)
        }
    }

    return (
        <section aria-labelledby="card-heading" className="card-view">
            <h2 id="card-heading">Sua carta</h2>
            <p className="card-word">{card.public.word}</p>
            <div className="card-details">
                <RevealableDetail
                    label="Dica"
                    actionNoun="dica"
                    text={card.public.hint}
                    isRevealed={revealed.hint}
                    onToggle={() => {
                        toggle('hint')
                    }}
                />
                <RevealableDetail
                    label="Sugestão"
                    actionNoun="sugestão"
                    text={card.public.suggestion}
                    isRevealed={revealed.suggestion}
                    onToggle={() => {
                        toggle('suggestion')
                    }}
                />
            </div>
        </section>
    )
}

interface RevealableDetailProps {
    label: string
    actionNoun: string
    text: string
    isRevealed: boolean
    onToggle: () => void
}

function RevealableDetail({
    label,
    actionNoun,
    text,
    isRevealed,
    onToggle,
}: RevealableDetailProps) {
    const regionId = useId()
    return (
        <div className="card-detail">
            <button
                type="button"
                className="card-reveal-button"
                aria-expanded={isRevealed}
                aria-controls={regionId}
                onClick={onToggle}
            >
                {isRevealed ? `Ocultar ${actionNoun}` : `Mostrar ${actionNoun}`}
            </button>
            <div id={regionId} aria-live="polite">
                {isRevealed && (
                    <p className="card-detail-text">
                        <span className="card-detail-label">{label}</span>
                        {text}
                    </p>
                )}
            </div>
        </div>
    )
}
