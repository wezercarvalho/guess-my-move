import { acenarCard } from '@guess-my-move/core'

import { GestureScreen } from './round/GestureScreen.js'
import './styles.css'

// A carta vem do pacote core. A tela entrega a carta completa só ao motor da
// rodada; a exibição usa a projeção pública, e o critério de avaliação nunca
// aparece para o jogador.
export function App() {
    return (
        <main className="app">
            <header className="app-header">
                <h1>Guess My Move</h1>
                <p>Ative a câmera, aperte Começar e faça o gesto da carta.</p>
            </header>

            <GestureScreen card={acenarCard} />
        </main>
    )
}
