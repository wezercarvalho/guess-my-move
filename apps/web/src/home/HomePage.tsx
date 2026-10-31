import { useId } from 'react'

import { PrivacyNotice } from '../shared/PrivacyNotice.js'

interface GameCardProps {
    title: string
    description: string
    href: string
    action: string
}

function GameCard({ title, description, href, action }: GameCardProps) {
    const headingId = useId()
    return (
        <article aria-labelledby={headingId} className="game-card">
            <h2 id={headingId}>{title}</h2>
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
                    title="Bolinhas de gude"
                    description="Bete, Triângulo e Cova, contra a meta ou o bot."
                    href="marbles.html"
                    action="Jogar bolinhas"
                />
                <GameCard
                    title="Arranha-Teia"
                    description="Escolha a cidade e balance entre os prédios com as mãos."
                    href="swing.html"
                    action="Jogar Arranha-Teia"
                />
            </div>
        </main>
    )
}
