import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Steps } from './Steps.js'

describe('Steps', () => {
    it('é uma lista ordenada com rótulo e marca só a etapa atual', () => {
        render(<Steps label="Etapas" items={['Um', 'Dois', 'Três']} current={2} />)
        const list = screen.getByRole('list', { name: 'Etapas' })
        expect(list.tagName).toBe('OL')
        const items = within(list).getAllByRole('listitem')
        expect(items.map((item) => item.getAttribute('aria-current'))).toEqual([null, 'step', null])
    })

    it('sem etapa atual, nenhuma é marcada', () => {
        render(<Steps label="Etapas" items={['Um', 'Dois']} current={null} />)
        for (const item of screen.getAllByRole('listitem')) {
            expect(item).not.toHaveAttribute('aria-current')
        }
    })
})
