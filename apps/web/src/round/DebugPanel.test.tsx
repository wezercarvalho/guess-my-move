import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DebugPanel } from './DebugPanel.js'

describe('DebugPanel', () => {
    it('mostra delegate, ângulo, inversões, amostras e latência', () => {
        render(
            <DebugPanel
                debug={{
                    delegate: 'GPU',
                    angleDeg: 12.34,
                    reversals: 3,
                    windowSamples: 8,
                    frames: 42,
                    medianMs: 85.4,
                    p95Ms: 104.2,
                }}
            />,
        )
        expect(screen.getByText('GPU')).toBeInTheDocument()
        expect(screen.getByText('12,3°')).toBeInTheDocument()
        expect(screen.getByText('3')).toBeInTheDocument()
        expect(screen.getByText('8')).toBeInTheDocument()
        expect(screen.getByText('42')).toBeInTheDocument()
        expect(screen.getByText('85 ms')).toBeInTheDocument()
        expect(screen.getByText('104 ms')).toBeInTheDocument()
    })

    it('mostra traços enquanto não há medição', () => {
        render(
            <DebugPanel
                debug={{
                    delegate: null,
                    angleDeg: null,
                    reversals: 0,
                    windowSamples: 0,
                    frames: 0,
                    medianMs: null,
                    p95Ms: null,
                }}
            />,
        )
        expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(4)
    })

    it('tem um título acessível', () => {
        render(
            <DebugPanel
                debug={{
                    delegate: 'CPU',
                    angleDeg: null,
                    reversals: 0,
                    windowSamples: 0,
                    frames: 0,
                    medianMs: null,
                    p95Ms: null,
                }}
            />,
        )
        expect(screen.getByRole('heading', { name: /depuração/i })).toBeInTheDocument()
    })
})
