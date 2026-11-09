import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Badge } from './Badge.js'

describe('Badge', () => {
    it('mostra o texto, que um leitor de tela lê como qualquer outro', () => {
        render(<Badge>Alpha</Badge>)
        const badge = screen.getByText('Alpha')
        expect(badge).toBeVisible()
        expect(badge).toHaveClass('ds-badge')
        expect(badge).not.toHaveAttribute('aria-hidden')
    })

    it('aceita uma classe extra sem perder a do design system', () => {
        render(<Badge className="extra">Beta</Badge>)
        expect(screen.getByText('Beta')).toHaveClass('ds-badge', 'extra')
    })
})
