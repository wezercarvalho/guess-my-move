import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../App.js'

beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() =>
        Promise.resolve(),
    )
})
afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
})
describe('seleção do baralho e idioma', () => {
    it('filtra por categoria/dificuldade e monta outra carta sem expor avaliação', () => {
        const { container } = render(<App />)
        fireEvent.change(screen.getByLabelText('Categoria'), {
            target: { value: 'arts' },
        })
        expect(
            screen.getByText('Regente de orquestra', {
                selector: '.card-word',
            }),
        ).toBeInTheDocument()
        fireEvent.change(screen.getByLabelText('Dificuldade'), {
            target: { value: 'easy' },
        })
        expect(screen.getByRole('status')).toHaveTextContent('Nenhuma carta')
        expect(container.textContent).not.toMatch(
            /amplitudeDeg|basePoints|hand-angle-oscillation/,
        )
    })
    it('traduz seleção, carta, controles e privacidade e preserva preferência', () => {
        render(<App />)
        fireEvent.change(screen.getByLabelText('Idioma'), {
            target: { value: 'en-US' },
        })
        expect(
            screen.getByText('Wave', { selector: '.card-word' }),
        ).toBeInTheDocument()
        expect(
            screen.getByRole('button', { name: 'Enable camera' }),
        ).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Start' })).toBeDisabled()
        expect(screen.getByText(/Privacy:/)).toBeInTheDocument()
        expect(localStorage.getItem('guess-my-move:cards-locale')).toBe('en-US')
    })
    it('oferece competitivo explícito com aviso escalar e não inicia sem câmera', () => {
        render(<App />)
        fireEvent.change(screen.getByLabelText('Modo'), {
            target: { value: 'competitive' },
        })
        expect(screen.getByText(/ângulo da mão/)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Começar' })).toBeDisabled()
    })
})
