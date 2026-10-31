import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { SwingDebugPanel } from './SwingDebugPanel.js'
import { type HandDebug, type HeadDebug } from './swingController.js'

const head = (patch: Partial<HeadDebug> = {}): HeadDebug => ({
    lookMode: 'face',
    faceVisible: true,
    calibrated: true,
    yawDeg: 12,
    pitchDeg: -3,
    climbIntent: null,
    climbProgress: 0,
    lockMode: 'following',
    lockPose: false,
    recenterProgress: 0,
    ...patch,
})

const hand = (patch: Partial<HandDebug> = {}): HandDebug => ({
    side: 'esq.',
    label: null,
    signal: null,
    metrics: null,
    openPalm: false,
    fist: false,
    lockPose: false,
    ...patch,
})

describe('SwingDebugPanel — trava da direção (CQ-012)', () => {
    it('mostra seguindo, sem gesto e sem centralização', () => {
        render(<SwingDebugPanel hands={[]} head={head()} />)
        const panel = screen.getByTestId('head-debug')
        expect(panel).toHaveTextContent('Trava da direção')
        expect(panel).toHaveTextContent('seguindo a cabeça')
        expect(panel).toHaveTextContent(/Dedão para baixo \(gesto\)\s*não/)
        expect(panel).toHaveTextContent(/Centralizando\s*—/)
    })

    it('travada: mostra o estado e o gesto visto', () => {
        render(<SwingDebugPanel hands={[]} head={head({ lockMode: 'locked', lockPose: true })} />)
        const panel = screen.getByTestId('head-debug')
        expect(panel).toHaveTextContent('travada')
        expect(panel).toHaveTextContent(/Dedão para baixo \(gesto\)\s*sim/)
    })

    it('aguardando o centro: mostra o progresso da centralização', () => {
        render(<SwingDebugPanel hands={[]} head={head({ lockMode: 'waiting', recenterProgress: 0.5 })} />)
        const panel = screen.getByTestId('head-debug')
        expect(panel).toHaveTextContent('aguardando o centro')
        expect(panel).toHaveTextContent(/Centralizando\s*50%/)
    })

    it('por mão, mostra se o dedão para baixo foi visto', () => {
        render(<SwingDebugPanel hands={[hand({ lockPose: true })]} head={head()} />)
        expect(screen.getByText('Dedão para baixo (travar)').nextElementSibling).toHaveTextContent('sim')
    })
})
