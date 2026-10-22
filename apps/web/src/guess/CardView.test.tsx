import { acenarCard, toPublicCard } from '@guess-my-move/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { CardView } from './CardView.js'

const card = toPublicCard(acenarCard)
const HINT = /cumprimentar ou se despedir/i
const SUGGESTION = /movimente-a de um lado/i

describe('CardView', () => {
    it('mostra só a palavra e mantém dica e sugestão fora do DOM por padrão', () => {
        render(<CardView card={card} />)
        expect(screen.getByText('Acenar')).toBeInTheDocument()
        expect(screen.queryByText(HINT)).not.toBeInTheDocument()
        expect(screen.queryByText(SUGGESTION)).not.toBeInTheDocument()
        expect(
            screen.getByRole('button', { name: /mostrar dica/i }),
        ).toHaveAttribute('aria-expanded', 'false')
        expect(
            screen.getByRole('button', { name: /mostrar sugestão/i }),
        ).toHaveAttribute('aria-expanded', 'false')
    })

    it('revela a dica sem revelar a sugestão', () => {
        render(<CardView card={card} />)
        fireEvent.click(screen.getByRole('button', { name: /mostrar dica/i }))
        expect(screen.getByText(HINT)).toBeInTheDocument()
        expect(screen.queryByText(SUGGESTION)).not.toBeInTheDocument()
        expect(
            screen.getByRole('button', { name: /ocultar dica/i }),
        ).toHaveAttribute('aria-expanded', 'true')
    })

    it('revela a sugestão sem revelar a dica', () => {
        render(<CardView card={card} />)
        fireEvent.click(
            screen.getByRole('button', { name: /mostrar sugestão/i }),
        )
        expect(screen.getByText(SUGGESTION)).toBeInTheDocument()
        expect(screen.queryByText(HINT)).not.toBeInTheDocument()
    })

    it('oculta de novo ao acionar o controle outra vez', () => {
        render(<CardView card={card} />)
        fireEvent.click(screen.getByRole('button', { name: /mostrar dica/i }))
        fireEvent.click(screen.getByRole('button', { name: /ocultar dica/i }))
        expect(screen.queryByText(HINT)).not.toBeInTheDocument()
        expect(
            screen.getByRole('button', { name: /mostrar dica/i }),
        ).toHaveAttribute('aria-expanded', 'false')
    })

    it('chama onReveal só ao revelar, informando o item', () => {
        const onReveal = vi.fn()
        render(<CardView card={card} onReveal={onReveal} />)
        fireEvent.click(screen.getByRole('button', { name: /mostrar dica/i }))
        expect(onReveal).toHaveBeenCalledTimes(1)
        expect(onReveal).toHaveBeenCalledWith('hint')
        fireEvent.click(screen.getByRole('button', { name: /ocultar dica/i }))
        expect(onReveal).toHaveBeenCalledTimes(1)
        fireEvent.click(
            screen.getByRole('button', { name: /mostrar sugestão/i }),
        )
        expect(onReveal).toHaveBeenLastCalledWith('suggestion')
    })

    it('volta a ocultar tudo quando a carta muda', () => {
        const { rerender } = render(<CardView card={card} />)
        fireEvent.click(screen.getByRole('button', { name: /mostrar dica/i }))
        expect(screen.getByText(HINT)).toBeInTheDocument()
        rerender(<CardView card={{ ...card, id: 'outra-carta' }} />)
        expect(screen.queryByText(HINT)).not.toBeInTheDocument()
    })
})
