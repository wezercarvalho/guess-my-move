import { acenarCard } from '@guess-my-move/core'

import { PocScreen } from './guess/PocScreen.js'
import './styles.css'

// A carta vem do pacote core (issue #11). A tela entrega a carta completa só ao
// motor da rodada, que julga o palpite; a exibição usa a projeção pública e o
// adivinhador nunca recebe nada da carta.
export function App() {
    return (
        <main className="app">
            <header className="app-header">
                <h1>Guess My Move</h1>
                <p>
                    PoC visual: ative a câmera, faça o gesto da carta e peça o
                    palpite da IA. O palpite não prova em tempo real nem garante
                    acerto.
                </p>
            </header>

            <PocScreen card={acenarCard} />
        </main>
    )
}
