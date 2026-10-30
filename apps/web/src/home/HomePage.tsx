import { useId } from 'react'

import { Badge } from '../design/index.js'
import { PrivacyNotice } from '../shared/PrivacyNotice.js'

interface GameCardProps {
    title: string
    description: string
    href: string
    action: string
    /** Selo ao lado do título (por exemplo, "Alpha"). */
    badge?: string
}

function GameCard({ title, description, href, action, badge }: GameCardProps) {
    const headingId = useId()
    return (
        <article aria-labelledby={headingId} className="game-card">
            <div className="game-card-head">
                <h2 id={headingId}>{title}</h2>
                {badge && <Badge>{badge}</Badge>}
            </div>
            <p>{description}</p>
            <a className="game-card-link" href={href}>
                {action}
            </a>
        </article>
    )
}

/** Menu inicial: um card por jogo. Os links são relativos à página do menu. */
export function HomePage() {
    return (
        <main className="app">
            <header className="app-header">
                <h1>Guess My Move</h1>
                <p>Escolha um jogo.</p>
            </header>

            <PrivacyNotice />

            <div className="game-cards">
                <GameCard
                    title="Jogo de cartas"
                    description="Faça o gesto da carta (Acenar) diante da câmera."
                    href="cards.html"
                    action="Jogar cartas"
                />
                <GameCard
                    title="Bolinhas de gude: bete"
                    description="Atire a bolinha azul no alvo vermelho com a mão."
                    href="marbles.html"
                    action="Jogar bolinhas"
                />
                <GameCard
                    title="Arranha-Teia"
                    description="Balance entre os prédios de Midtown e lance a teia com o gesto “eu te amo”."
                    href="swing.html"
                    action="Jogar Arranha-Teia"
                />
                <GameCard
                    title="Violão no Ar"
                    description="Forme o acorde com uma mão e bata com a outra."
                    href="guitar.html"
                    action="Jogar Violão no Ar"
                    badge="Alpha"
                />
            </div>
        </main>
    )
}
