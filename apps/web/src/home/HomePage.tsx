import { useId } from 'react'

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
                <p>Escolha um jogo. A câmera e o reconhecimento da mão funcionam no seu navegador.</p>
            </header>

            <p className="privacy-notice" role="note">
                <strong>Privacidade:</strong> nenhuma imagem da câmera é enviada, gravada ou
                registrada.
            </p>

            <div className="game-cards">
                <GameCard
                    title="Jogo de cartas"
                    description="Veja a carta (Acenar), aperte Começar e faça o gesto diante da câmera. O app reconhece o aceno pelo movimento da sua mão."
                    href="cards.html"
                    action="Jogar o jogo de cartas"
                />
                <GameCard
                    title="Bolinhas de gude: bete"
                    description="Faça a pinça com a mão, arraste para trás e abra os dedos para atirar a bolinha azul no alvo vermelho."
                    href="marbles.html"
                    action="Jogar bolinhas de gude"
                />
            </div>
        </main>
    )
}
