import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Eyebrow } from './Eyebrow.js'
import { Notice } from './Notice.js'
import { Panel } from './Panel.js'

describe('Panel, Eyebrow e Notice', () => {
    it('Panel é uma região (section) com a classe do sistema e aceita a variante elevada', () => {
        const { rerender } = render(<Panel aria-label="Campo">conteúdo</Panel>)
        const panel = screen.getByRole('region', { name: 'Campo' })
        expect(panel).toHaveClass('ds-panel')
        expect(panel).not.toHaveClass('ds-panel--raised')
        rerender(
            <Panel aria-label="Campo" raised>
                conteúdo
            </Panel>,
        )
        expect(screen.getByRole('region', { name: 'Campo' })).toHaveClass('ds-panel--raised')
    })

    it('Eyebrow é um parágrafo com a classe do rótulo', () => {
        render(<Eyebrow>Bete solo</Eyebrow>)
        expect(screen.getByText('Bete solo')).toHaveClass('ds-eyebrow')
    })

    it('Notice se anuncia como nota', () => {
        render(<Notice>Privacidade</Notice>)
        expect(screen.getByRole('note')).toHaveClass('ds-notice')
    })
})
