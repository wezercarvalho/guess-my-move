import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ExternalProviderNotice } from './ExternalProviderNotice.js'

describe('ExternalProviderNotice', () => {
    it('avisa que os frames vão a um provedor externo', () => {
        render(<ExternalProviderNotice />)
        const note = screen.getByRole('note')
        expect(note).toHaveTextContent(/provedor de ia externo/i)
        expect(note).toHaveTextContent(/não são armazenados/i)
    })
})
