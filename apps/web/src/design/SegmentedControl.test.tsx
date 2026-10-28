import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { SegmentedControl } from './SegmentedControl.js'

const options = [
    { value: 'pinch', label: 'Pinça' },
    { value: 'flick', label: 'Estalo (alpha)' },
] as const

describe('SegmentedControl', () => {
    it('é um grupo com legenda e botões de rádio nativos com rótulos textuais', () => {
        render(
            <SegmentedControl legend="Modo de tiro" name="mode" value="pinch" options={options} onChange={() => undefined} />,
        )
        const group = screen.getByRole('group', { name: 'Modo de tiro' })
        const radios = within(group).getAllByRole('radio')
        expect(radios).toHaveLength(2)
        expect(within(group).getByRole('radio', { name: 'Pinça' })).toBeChecked()
        expect(within(group).getByRole('radio', { name: /estalo/i })).not.toBeChecked()
    })

    it('chama onChange com o valor escolhido', () => {
        const onChange = vi.fn()
        render(
            <SegmentedControl legend="Modo de tiro" name="mode" value="pinch" options={options} onChange={onChange} />,
        )
        fireEvent.click(screen.getByRole('radio', { name: /estalo/i }))
        expect(onChange).toHaveBeenCalledWith('flick')
    })

    it('os botões de rádio compartilham o nome, então o teclado troca de opção com as setas', () => {
        render(
            <SegmentedControl legend="Modo de tiro" name="mode" value="flick" options={options} onChange={() => undefined} />,
        )
        for (const radio of screen.getAllByRole('radio')) expect(radio).toHaveAttribute('name', 'mode')
        expect(screen.getByRole('radio', { name: /estalo/i })).toBeChecked()
    })
})
