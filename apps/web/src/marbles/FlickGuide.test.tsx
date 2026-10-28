import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { FlickGuide } from './FlickGuide.js'
import { currentStep } from './flickStep.js'

describe('currentStep', () => {
    it('sem rodada em andamento não destaca etapa', () => {
        expect(currentStep({ state: 'idle', phase: 'idle' })).toBeNull()
        expect(currentStep({ state: 'camera_denied', phase: 'idle' })).toBeNull()
        expect(currentStep({ state: 'tracker_error', phase: 'idle' })).toBeNull()
    })

    it('pronto e ainda sem armar: etapa 1 (fechar a mão com o polegar preso)', () => {
        expect(currentStep({ state: 'ready', phase: 'idle' })).toBe(1)
    })

    it('armado: etapa 2 (apontar); confirmando o polegar esticado: etapa 3', () => {
        expect(currentStep({ state: 'aiming', phase: 'armed' })).toBe(2)
        expect(currentStep({ state: 'aiming', phase: 'pending' })).toBe(3)
    })

    it('bolinha rolando ou acerto: etapa 4', () => {
        expect(currentStep({ state: 'rolling', phase: 'idle' })).toBe(4)
        expect(currentStep({ state: 'hit', phase: 'idle' })).toBe(4)
    })
})

describe('FlickGuide', () => {
    it('lista as quatro etapas e marca só a atual com aria-current', () => {
        render(<FlickGuide state="aiming" phase="armed" lastResult={null} />)
        const list = screen.getByRole('list', { name: /etapas do estalo/i })
        const items = within(list).getAllByRole('listitem')
        expect(items).toHaveLength(4)
        expect(items[0]).toHaveTextContent(/feche a mão.*polegar preso/i)
        expect(items[1]).toHaveTextContent(/aponte/i)
        expect(items[2]).toHaveTextContent(/estique o polegar/i)
        expect(items[3]).toHaveTextContent(/bolinha/i)
        expect(items.map((item) => item.getAttribute('aria-current'))).toEqual([
            null,
            'step',
            null,
            null,
        ])
    })

    it('sem etapa atual nenhum item é marcado', () => {
        render(<FlickGuide state="idle" phase="idle" lastResult={null} />)
        for (const item of screen.getAllByRole('listitem')) {
            expect(item).not.toHaveAttribute('aria-current')
        }
    })

    it('mostra a dica do último estalo que não disparou, numa região aria-live', () => {
        const { rerender } = render(<FlickGuide state="ready" phase="idle" lastResult="não sustentado" />)
        const hint = screen.getByTestId('flick-hint')
        expect(hint).toHaveAttribute('aria-live', 'polite')
        expect(hint).toHaveTextContent(/deixe-o esticado/i)

        rerender(<FlickGuide state="ready" phase="idle" lastResult="mão aberta" />)
        expect(hint).toHaveTextContent(/punho.*só o polegar/i)

        rerender(<FlickGuide state="ready" phase="idle" lastResult="fraco demais" />)
        expect(hint).toHaveTextContent(/de uma vez/i)

        rerender(<FlickGuide state="ready" phase="idle" lastResult="sem direção" />)
        expect(hint).toHaveTextContent(/direção da mão/i)
    })

    it('depois de um estalo disparado ou sem estalo anterior não há dica de erro', () => {
        render(<FlickGuide state="ready" phase="idle" lastResult="disparado" />)
        expect(screen.getByTestId('flick-hint')).toBeEmptyDOMElement()
    })
})
