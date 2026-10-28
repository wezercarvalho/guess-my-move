import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DrawerPanel, DrawerToggle } from './Drawer.js'
import { useDrawer } from './useDrawer.js'

function Example() {
    const drawer = useDrawer()
    return (
        <div>
            <DrawerToggle open={drawer.open} panelId={drawer.panelId} onToggle={drawer.toggle}>
                Depuração
            </DrawerToggle>
            <DrawerPanel open={drawer.open} panelId={drawer.panelId}>
                <p>Conteúdo da gaveta</p>
            </DrawerPanel>
        </div>
    )
}

describe('Drawer', () => {
    it('começa recolhida: o botão anuncia aria-expanded=false e o conteúdo fica fora da árvore de acessibilidade', () => {
        render(<Example />)
        const button = screen.getByRole('button', { name: 'Depuração' })
        expect(button).toHaveAttribute('aria-expanded', 'false')
        expect(screen.queryByText('Conteúdo da gaveta')).not.toBeVisible()
        expect(screen.queryByRole('paragraph', { name: /conteúdo/i })).not.toBeInTheDocument()
    })

    it('o botão aponta o painel por aria-controls', () => {
        render(<Example />)
        const button = screen.getByRole('button', { name: 'Depuração' })
        const panelId = button.getAttribute('aria-controls')
        expect(panelId).toBeTruthy()
        expect(document.getElementById(panelId ?? '')).toContainElement(
            screen.getByText('Conteúdo da gaveta'),
        )
    })

    it('abre e fecha pelo botão, anunciando o estado', () => {
        render(<Example />)
        const button = screen.getByRole('button', { name: 'Depuração' })
        fireEvent.click(button)
        expect(button).toHaveAttribute('aria-expanded', 'true')
        expect(screen.getByText('Conteúdo da gaveta')).toBeVisible()
        fireEvent.click(button)
        expect(button).toHaveAttribute('aria-expanded', 'false')
        expect(screen.getByText('Conteúdo da gaveta')).not.toBeVisible()
    })

    it('duas gavetas têm ids diferentes', () => {
        render(
            <>
                <Example />
                <Example />
            </>,
        )
        const ids = screen
            .getAllByRole('button', { name: 'Depuração' })
            .map((button) => button.getAttribute('aria-controls'))
        expect(new Set(ids).size).toBe(2)
    })
})
