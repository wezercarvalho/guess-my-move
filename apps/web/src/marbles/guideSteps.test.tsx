import { modes } from '@guess-my-move/marbles'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { STEPS, currentStep, guideHint, rulesText } from './guideSteps.js'
import { ShotGuide } from './ShotGuide.js'

const holeMode = modes.find((m) => m.id === 'hole')!.create()

/** Conta frases: segmentos terminados em . ! ou ? com conteúdo. */
function sentenceCount(text: string): number {
    return text.split(/[.!?]+/).filter((s) => s.trim().length > 0).length
}

describe('currentStep', () => {
    it('fora da mira (não pronto) nenhuma etapa fica destacada', () => {
        expect(
            currentStep({ shotControl: 'flick', ready: false, aiming: false, flickPhase: 'idle', shotReady: false }),
        ).toBeNull()
        expect(
            currentStep({ shotControl: 'pinch', ready: false, aiming: false, flickPhase: 'idle', shotReady: false }),
        ).toBeNull()
    })

    it('pronto e sem armar: etapa 1 nos dois controles', () => {
        expect(
            currentStep({ shotControl: 'flick', ready: true, aiming: false, flickPhase: 'idle', shotReady: false }),
        ).toBe(1)
        expect(
            currentStep({ shotControl: 'pinch', ready: true, aiming: false, flickPhase: 'idle', shotReady: false }),
        ).toBe(1)
    })

    it('estalo: armado é a etapa 2 e confirmando é a etapa 3', () => {
        expect(
            currentStep({ shotControl: 'flick', ready: true, aiming: true, flickPhase: 'armed', shotReady: false }),
        ).toBe(2)
        expect(
            currentStep({ shotControl: 'flick', ready: true, aiming: true, flickPhase: 'pending', shotReady: false }),
        ).toBe(3)
    })

    it('pinça: mirando é a etapa 2 e, com arrasto bom, a etapa 3', () => {
        expect(
            currentStep({ shotControl: 'pinch', ready: true, aiming: true, flickPhase: 'idle', shotReady: false }),
        ).toBe(2)
        expect(
            currentStep({ shotControl: 'pinch', ready: true, aiming: true, flickPhase: 'idle', shotReady: true }),
        ).toBe(3)
    })
})

describe('rulesText: cada modo e adversário traz vitória, derrota e empate em até 2 frases', () => {
    for (const entry of modes) {
        for (const opponent of ['target', 'bot'] as const) {
            it(`modo ${entry.id} contra ${opponent}`, () => {
                const mode = entry.create()
                const text = rulesText(mode, opponent).toLowerCase()
                expect(text).toMatch(/vit[óo]ria|vence/i)
                expect(text).toMatch(/derrota|perde/i)
                expect(text).toMatch(/empat/i)
                expect(sentenceCount(rulesText(mode, opponent))).toBeLessThanOrEqual(2)
            })
        }
    }
})

describe('guideHint', () => {
    const base = {
        shotControl: 'flick',
        modeId: 'bete',
        ready: true,
        aiming: false,
        handVisible: true,
        lastResult: null,
    } as const

    it('sem mão à vista, dá a dica de posição', () => {
        expect(guideHint({ ...base, handVisible: false })).toMatch(/palma para a câmera/i)
    })

    it('depois de um estalo que não disparou, diz o que corrigir', () => {
        expect(guideHint({ ...base, lastResult: 'fraco demais' })).toMatch(/de uma vez/i)
        expect(guideHint({ ...base, lastResult: 'não sustentado' })).toMatch(/segure/i)
        expect(guideHint({ ...base, lastResult: 'mão aberta' })).toMatch(/punho/i)
        expect(guideHint({ ...base, lastResult: 'sem mira' })).toMatch(/afaste mais/i)
    })

    it('no modo Cova, o estalo fraco dá a dica específica da cova', () => {
        expect(guideHint({ ...base, modeId: 'hole', lastResult: 'fraco demais' })).toMatch(/cova/i)
    })

    it('estalo disparado, sem resultado anterior ou na pinça não geram dica de erro', () => {
        expect(guideHint({ ...base, lastResult: 'disparado' })).toBeNull()
        expect(guideHint(base)).toBeNull()
        expect(guideHint({ ...base, shotControl: 'pinch', lastResult: 'sem mira' })).toBeNull()
    })
})

describe('ShotGuide', () => {
    it('mostra as regras do modo e do adversário, as etapas e marca só a atual', () => {
        render(
            <ShotGuide
                mode={holeMode}
                modeId="hole"
                opponent="bot"
                shotControl="flick"
                ready
                aiming
                flickPhase="armed"
                shotReady={false}
                handVisible
                lastResult={null}
            />,
        )
        expect(screen.getByTestId('guide-rules')).toHaveTextContent(/completar/i)
        const list = screen.getByRole('list', { name: /como jogar/i })
        const items = within(list).getAllByRole('listitem')
        expect(items).toHaveLength(STEPS.flick.length)
        expect(items.map((item) => item.getAttribute('aria-current'))).toEqual([null, 'step', null])
    })

    it('na pinça mostra as etapas da pinça com a primeira destacada quando pronto', () => {
        render(
            <ShotGuide
                mode={holeMode}
                modeId="hole"
                opponent="target"
                shotControl="pinch"
                ready
                aiming={false}
                flickPhase="idle"
                shotReady={false}
                handVisible
                lastResult={null}
            />,
        )
        const items = within(screen.getByRole('list', { name: /como jogar/i })).getAllByRole('listitem')
        expect(items[0]).toHaveTextContent(/feche a pinça/i)
        expect(items[0]).toHaveAttribute('aria-current', 'step')
    })

    it('a dica fica numa região aria-live e some quando não há o que corrigir', () => {
        const { rerender } = render(
            <ShotGuide
                mode={holeMode}
                modeId="bete"
                opponent="target"
                shotControl="flick"
                ready
                aiming={false}
                flickPhase="idle"
                shotReady={false}
                handVisible
                lastResult="não sustentado"
            />,
        )
        const hint = screen.getByTestId('guide-hint')
        expect(hint).toHaveAttribute('aria-live', 'polite')
        expect(hint).toHaveTextContent(/segure/i)
        rerender(
            <ShotGuide
                mode={holeMode}
                modeId="bete"
                opponent="target"
                shotControl="flick"
                ready
                aiming={false}
                flickPhase="idle"
                shotReady={false}
                handVisible
                lastResult="disparado"
            />,
        )
        expect(screen.getByTestId('guide-hint')).toBeEmptyDOMElement()
    })
})
