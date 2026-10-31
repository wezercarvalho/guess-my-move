import { act, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { type FeedbackInput } from './feedback.js'
import { SwingFeedback, TOAST_MS } from './SwingFeedback.js'

const base: FeedbackInput = {
    phase: 'playing',
    cameraActive: true,
    lookMode: 'face',
    faceTrackerStatus: 'ready',
    faceVisible: true,
    lockMode: 'following',
    gripped: false,
    headClimb: { intent: null, progress: 0, climbing: false },
    cue: 'swing',
    webSides: [],
}

beforeEach(() => {
    vi.useFakeTimers()
})

afterEach(() => {
    vi.useRealTimers()
})

const region = () => screen.getByTestId('swing-feedback')

describe('SwingFeedback', () => {
    it('é uma região de aviso educada, sempre presente, e vazia sem nada a dizer', () => {
        render(<SwingFeedback input={base} />)
        expect(region()).toHaveAttribute('aria-live', 'polite')
        expect(region()).toBeEmptyDOMElement()
    })

    it('mostra os estados que duram enquanto valem', () => {
        const { rerender } = render(<SwingFeedback input={{ ...base, lockMode: 'locked' }} />)
        expect(within(region()).getByText('Direção travada')).toBeInTheDocument()
        rerender(<SwingFeedback input={base} />)
        expect(within(region()).queryByText('Direção travada')).not.toBeInTheDocument()
    })

    it('na espera de escalar mostra o texto da contagem e uma barra com o progresso', () => {
        render(
            <SwingFeedback
                input={{
                    ...base,
                    gripped: true,
                    cue: 'grip',
                    headClimb: { intent: 'up', progress: 0.4, climbing: false },
                }}
            />,
        )
        expect(within(region()).getByText('Olhando para cima… 1,2 s')).toBeInTheDocument()
        const bar = within(region()).getByRole('progressbar', { name: 'Espera para escalar' })
        expect(bar).toHaveAttribute('aria-valuenow', '40')
    })

    it('sem espera não há barra', () => {
        render(<SwingFeedback input={{ ...base, gripped: true, cue: 'grip' }} />)
        expect(within(region()).queryByRole('progressbar')).not.toBeInTheDocument()
    })

    it('um evento vira aviso e some sozinho depois de TOAST_MS', () => {
        const { rerender } = render(<SwingFeedback input={{ ...base, lockMode: 'locked' }} />)
        rerender(<SwingFeedback input={base} />)
        expect(within(region()).getByText('Direção liberada')).toBeInTheDocument()
        act(() => {
            vi.advanceTimersByTime(TOAST_MS - 50)
        })
        expect(within(region()).getByText('Direção liberada')).toBeInTheDocument()
        act(() => {
            vi.advanceTimersByTime(100)
        })
        expect(within(region()).queryByText('Direção liberada')).not.toBeInTheDocument()
    })

    it('a mesma entrada de novo não repete o aviso', () => {
        const { rerender } = render(<SwingFeedback input={{ ...base, gripped: true }} />)
        rerender(<SwingFeedback input={base} />)
        act(() => {
            vi.advanceTimersByTime(TOAST_MS + 50)
        })
        rerender(<SwingFeedback input={{ ...base }} />)
        expect(within(region()).queryByText('Soltou da parede')).not.toBeInTheDocument()
    })

    it('no máximo três avisos ao mesmo tempo, ficando os mais novos', () => {
        const busy: FeedbackInput = {
            ...base,
            faceVisible: false,
            lockMode: 'locked',
            gripped: true,
            webSides: [-1],
        }
        const { rerender } = render(<SwingFeedback input={busy} />)
        rerender(<SwingFeedback input={{ ...base, faceVisible: true }} />)
        const items = region().querySelectorAll('.swing-toast')
        expect(items).toHaveLength(3)
        expect(within(region()).queryByText('Direção liberada')).not.toBeInTheDocument()
        expect(within(region()).getByText('Rosto detectado')).toBeInTheDocument()
    })

    it('avisos e estados ficam em listas separadas, os avisos acima dos estados', () => {
        const { rerender } = render(<SwingFeedback input={{ ...base, gripped: true, lockMode: 'locked' }} />)
        rerender(<SwingFeedback input={{ ...base, lockMode: 'locked' }} />)
        const lists = region().querySelectorAll('ul')
        expect(lists).toHaveLength(2)
        expect(lists[0]).toHaveClass('swing-feedback__toasts')
        expect(lists[1]).toHaveClass('swing-feedback__chips')
    })

    it('desmontar cancela os temporizadores sem erro', () => {
        const { rerender, unmount } = render(<SwingFeedback input={{ ...base, gripped: true }} />)
        rerender(<SwingFeedback input={base} />)
        unmount()
        expect(() => {
            act(() => {
                vi.advanceTimersByTime(TOAST_MS * 2)
            })
        }).not.toThrow()
    })

    it('fora do jogo não mostra nada', () => {
        render(<SwingFeedback input={{ ...base, phase: 'loading', lockMode: 'locked', gripped: true }} />)
        expect(region()).toBeEmptyDOMElement()
    })
})
