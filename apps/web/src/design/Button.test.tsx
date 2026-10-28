import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { Button } from './Button.js'

describe('Button', () => {
    it('é primário por padrão e não envia formulário sem querer (type=button)', () => {
        render(<Button>Ativar câmera</Button>)
        const button = screen.getByRole('button', { name: 'Ativar câmera' })
        expect(button).toHaveClass('ds-button', 'ds-button--primary')
        expect(button).toHaveAttribute('type', 'button')
    })

    it.each(['primary', 'secondary', 'text'] as const)('aplica a variante %s', (variant) => {
        render(<Button variant={variant}>Ação</Button>)
        expect(screen.getByRole('button')).toHaveClass(`ds-button--${variant}`)
    })

    it('chama onClick e respeita disabled', () => {
        const onClick = vi.fn()
        const { rerender } = render(<Button onClick={onClick}>Ir</Button>)
        fireEvent.click(screen.getByRole('button'))
        expect(onClick).toHaveBeenCalledTimes(1)

        rerender(
            <Button onClick={onClick} disabled>
                Ir
            </Button>,
        )
        fireEvent.click(screen.getByRole('button'))
        expect(onClick).toHaveBeenCalledTimes(1)
    })

    it('repassa atributos como aria-expanded e junta classes extras', () => {
        render(
            <Button aria-expanded={false} className="extra">
                Abrir
            </Button>,
        )
        const button = screen.getByRole('button')
        expect(button).toHaveAttribute('aria-expanded', 'false')
        expect(button).toHaveClass('extra')
    })
})
