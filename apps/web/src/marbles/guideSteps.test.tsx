import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { STEPS, currentStep, guideHint } from './guideSteps.js'
import { ShotGuide } from './ShotGuide.js'

describe('currentStep', () => {
    it('sem rodada em andamento, rolando ou com acerto, nenhuma etapa fica destacada', () => {
        for (const state of ['idle', 'camera_denied', 'tracker_error', 'rolling', 'hit'] as const) {
            expect(currentStep({ mode: 'flick', state, phase: 'idle', shotReady: false })).toBeNull()
            expect(currentStep({ mode: 'pinch', state, phase: 'idle', shotReady: false })).toBeNull()
        }
    })

    it('pronto e ainda sem armar: etapa 1 nos dois modos', () => {
        expect(currentStep({ mode: 'flick', state: 'ready', phase: 'idle', shotReady: false })).toBe(1)
        expect(currentStep({ mode: 'pinch', state: 'ready', phase: 'idle', shotReady: false })).toBe(1)
    })

    it('estalo: armado é a etapa 2 e confirmando o polegar esticado é a etapa 3', () => {
        expect(currentStep({ mode: 'flick', state: 'aiming', phase: 'armed', shotReady: false })).toBe(2)
        expect(currentStep({ mode: 'flick', state: 'aiming', phase: 'pending', shotReady: false })).toBe(3)
    })

    it('pinça: mirando é a etapa 2 e, com o arrasto bom, a etapa 3 (abrir os dedos)', () => {
        expect(currentStep({ mode: 'pinch', state: 'aiming', phase: 'idle', shotReady: false })).toBe(2)
        expect(currentStep({ mode: 'pinch', state: 'aiming', phase: 'idle', shotReady: true })).toBe(3)
    })
})

describe('guideHint', () => {
    const base = { mode: 'flick', state: 'ready', handVisible: true, lastResult: null } as const

    it('sem mão à vista, dá a dica de posição', () => {
        expect(guideHint({ ...base, handVisible: false })).toMatch(/palma para a câmera/i)
    })

    it('depois de um estalo que não disparou, diz o que corrigir (e só enquanto a rodada não rola)', () => {
        expect(guideHint({ ...base, lastResult: 'fraco demais' })).toMatch(/de uma vez/i)
        expect(guideHint({ ...base, lastResult: 'não sustentado' })).toMatch(/segure/i)
        expect(guideHint({ ...base, lastResult: 'mão aberta' })).toMatch(/punho/i)
        expect(guideHint({ ...base, lastResult: 'sem mira' })).toMatch(/afaste mais/i)
        expect(guideHint({ ...base, state: 'rolling', lastResult: 'sem mira' })).toBeNull()
    })

    it('estalo disparado, sem resultado anterior ou na pinça não geram dica de erro', () => {
        expect(guideHint({ ...base, lastResult: 'disparado' })).toBeNull()
        expect(guideHint(base)).toBeNull()
        expect(guideHint({ ...base, mode: 'pinch', lastResult: 'sem mira' })).toBeNull()
    })
})

describe('ShotGuide', () => {
    it('lista as etapas do modo e marca só a atual com aria-current', () => {
        render(<ShotGuide mode="flick" state="aiming" phase="armed" shotReady={false} handVisible lastResult={null} />)
        const list = screen.getByRole('list', { name: /como jogar/i })
        const items = within(list).getAllByRole('listitem')
        expect(items).toHaveLength(STEPS.flick.length)
        expect(items[0]).toHaveTextContent(/polegar preso/i)
        expect(items[2]).toHaveTextContent(/estique o polegar/i)
        expect(items.map((item) => item.getAttribute('aria-current'))).toEqual([null, 'step', null])
    })

    it('na pinça mostra as etapas da pinça', () => {
        render(<ShotGuide mode="pinch" state="ready" phase="idle" shotReady={false} handVisible lastResult={null} />)
        const items = within(screen.getByRole('list', { name: /como jogar/i })).getAllByRole('listitem')
        expect(items).toHaveLength(STEPS.pinch.length)
        expect(items[0]).toHaveTextContent(/feche a pinça/i)
        expect(items[2]).toHaveTextContent(/abra os dedos/i)
        expect(items[0]).toHaveAttribute('aria-current', 'step')
    })

    it('a dica fica numa região aria-live e some quando não há o que corrigir', () => {
        const { rerender } = render(
            <ShotGuide mode="flick" state="ready" phase="idle" shotReady={false} handVisible lastResult="não sustentado" />,
        )
        const hint = screen.getByTestId('guide-hint')
        expect(hint).toHaveAttribute('aria-live', 'polite')
        expect(hint).toHaveTextContent(/segure/i)
        rerender(<ShotGuide mode="flick" state="ready" phase="idle" shotReady={false} handVisible lastResult="disparado" />)
        expect(screen.getByTestId('guide-hint')).toBeEmptyDOMElement()
    })
})
