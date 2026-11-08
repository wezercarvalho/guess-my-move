import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import '../styles.css'
import './swing.css'
import { SwingApp } from './SwingApp.js'

const container = document.getElementById('root')
if (!container) {
    throw new Error('Elemento #root não encontrado no swing.html.')
}

createRoot(container).render(
    <StrictMode>
        <SwingApp />
    </StrictMode>,
)
