import { acenarCard, toPublicCard } from '@guess-my-move/core'

import { PocScreen } from './guess/PocScreen.js'
import './styles.css'

// A carta vem do pacote core (issue #11); a tela recebe apenas a projeção
// pública — a avaliação nunca chega ao cliente de exibição nem ao adivinhador.
const acenarPublic = toPublicCard(acenarCard)

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

            <PocScreen card={acenarPublic} />
        </main>
    )
}
