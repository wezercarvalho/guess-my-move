import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import '../styles.css'
import './marbles.css'
import { MarblesScreen } from './MarblesScreen.js'

const container = document.getElementById('root')
if (!container) {
    throw new Error('Elemento #root não encontrado no marbles.html.')
}

createRoot(container).render(
    <StrictMode>
        <main className="app">
            <MarblesScreen />
        </main>
    </StrictMode>,
)
