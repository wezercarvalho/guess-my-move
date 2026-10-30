import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { HomePage } from './HomePage.js'

describe('HomePage', () => {
    it('mostra o título e um card por jogo', () => {
        render(<HomePage />)
        expect(screen.getByRole('heading', { level: 1, name: /guess my move/i })).toBeInTheDocument()
        const cards = screen.getAllByRole('article')
        expect(cards).toHaveLength(4)
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
        expect(within(card).getByText(/bolinha azul/i)).toBeInTheDocument()
        expect(within(card).getByRole('link', { name: /jogar/i })).toHaveAttribute(
            'href',
            'marbles.html',
        )
    })

    it('o card do Arranha-Teia leva a swing.html', () => {
        render(<HomePage />)
        const card = screen.getByRole('article', { name: /arranha-teia/i })
        expect(within(card).getByText(/eu te amo/i)).toBeInTheDocument()
        expect(within(card).getByRole('link', { name: /jogar/i })).toHaveAttribute(
            'href',
            'swing.html',
        )
    })

    it('o card do Violão no Ar leva a guitar.html e mostra o selo Alpha', () => {
        render(<HomePage />)
        const card = screen.getByRole('article', { name: /violão no ar/i })
        expect(within(card).getByText('Alpha')).toBeInTheDocument()
        expect(within(card).getByText(/acorde/i)).toBeInTheDocument()
        expect(within(card).getByRole('link', { name: /jogar violão no ar/i })).toHaveAttribute(
            'href',
            'guitar.html',
        )
    })

    it('só o Violão no Ar tem o selo Alpha: os outros três cards ficam iguais', () => {
        render(<HomePage />)
        expect(screen.getAllByText('Alpha')).toHaveLength(1)
        for (const name of [/jogo de cartas/i, /bolinhas de gude/i, /arranha-teia/i]) {
            const card = screen.getByRole('article', { name })
            expect(within(card).queryByText('Alpha')).not.toBeInTheDocument()
        }
    })

    it('avisa que tudo roda no navegador, sem enviar imagens', () => {
        render(<HomePage />)
        expect(screen.getByRole('note')).toHaveTextContent(/nada é enviado/i)
    })
})
