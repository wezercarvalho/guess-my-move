import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { App } from './App.js'

describe('App', () => {
    it('renderiza o título do jogo e a carta pública', () => {
        render(<App />)
        expect(
            screen.getByRole('heading', { name: 'Guess My Move' }),
        ).toBeInTheDocument()
        // A palavra da carta (parte pública) é visível ao jogador.
        expect(screen.getByText('Acenar')).toBeInTheDocument()
    })
})
