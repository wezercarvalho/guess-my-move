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
    it('mostra seguindo e sem gesto', () => {
        render(<SwingDebugPanel hands={[]} head={head()} />)
        const panel = screen.getByTestId('head-debug')
        expect(panel).toHaveTextContent('Trava da direção')
        expect(panel).toHaveTextContent('seguindo a cabeça')
        expect(panel).toHaveTextContent(/Dedão para baixo \(gesto\)\s*não/)
    })

    it('travada: mostra o estado e o gesto visto', () => {
        render(<SwingDebugPanel hands={[]} head={head({ lockMode: 'locked', lockPose: true })} />)
        const panel = screen.getByTestId('head-debug')
        expect(panel).toHaveTextContent('travada')
        expect(panel).toHaveTextContent(/Dedão para baixo \(gesto\)\s*sim/)
    })

    it('por mão, mostra se o dedão para baixo foi visto', () => {
        render(<SwingDebugPanel hands={[hand({ lockPose: true })]} head={head()} />)
        expect(screen.getByText('Dedão para baixo (travar)').nextElementSibling).toHaveTextContent('sim')
    })
})
