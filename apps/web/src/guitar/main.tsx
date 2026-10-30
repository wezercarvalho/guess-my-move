import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import '../styles.css'
import './guitar.css'
import { GuitarScreen } from './GuitarScreen.js'

const container = document.getElementById('root')
if (!container) {
    throw new Error('Elemento #root não encontrado no guitar.html.')
}

createRoot(container).render(
    <StrictMode>
        <main className="app app-wide">
            <GuitarScreen />
        </main>
    </StrictMode>,
)
