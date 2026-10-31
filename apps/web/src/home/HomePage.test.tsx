import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { HomePage } from './HomePage.js'

describe('HomePage', () => {
    it('mostra o título e um card por jogo', () => {
        render(<HomePage />)
        expect(screen.getByRole('heading', { level: 1, name: /guess my move/i })).toBeInTheDocument()
        const cards = screen.getAllByRole('article')
        expect(cards).toHaveLength(3)
    })

    it('o card do jogo de cartas leva a cards.html', () => {
        render(<HomePage />)
        const card = screen.getByRole('article', { name: /jogo de cartas/i })
        expect(within(card).getByText(/acenar/i)).toBeInTheDocument()
        expect(within(card).getByRole('link', { name: /jogar/i })).toHaveAttribute(
            'href',
            'cards.html',
        )
    })

    it('o card das bolinhas de gude leva a marbles.html', () => {
        render(<HomePage />)
        const card = screen.getByRole('article', { name: /bolinhas de gude/i })
        expect(within(card).getByText(/Bete, Triângulo e Cova/i)).toBeInTheDocument()
        expect(within(card).getByRole('link', { name: /jogar/i })).toHaveAttribute(
            'href',
            'marbles.html',
        )
    })

    it('o card do Arranha-Teia leva a swing.html', () => {
        render(<HomePage />)
        const card = screen.getByRole('article', { name: /arranha-teia/i })
        expect(within(card).getByText(/escolha a cidade/i)).toBeInTheDocument()
        expect(within(card).getByRole('link', { name: /jogar/i })).toHaveAttribute(
            'href',
            'swing.html',
        )
    })

    it('avisa que tudo roda no navegador, sem enviar imagens', () => {
        render(<HomePage />)
        expect(screen.getByRole('note')).toHaveTextContent(/nada é enviado/i)
    })
})
