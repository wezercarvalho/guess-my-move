import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import '../styles.css'
import './home.css'
import { HomePage } from './HomePage.js'

const container = document.getElementById('root')
if (!container) {
    throw new Error('Elemento #root não encontrado no index.html.')
}

createRoot(container).render(
    <StrictMode>
        <HomePage />
    </StrictMode>,
)
