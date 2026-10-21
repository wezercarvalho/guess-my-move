import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { App } from './App.js'

describe('App', () => {
    it('renderiza o título do jogo', () => {
        render(<App />)
        expect(
            screen.getByRole('heading', { name: 'Guess My Move' }),
        ).toBeInTheDocument()
    })
})
