import { chordById } from '@guess-my-move/guitar'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ChordDiagram } from './ChordDiagram.js'

describe('ChordDiagram', () => {
    it('é uma imagem com a descrição em texto, corda por corda', () => {
        render(<ChordDiagram chord={chordById('Em')} />)
        const image = screen.getByRole('img', { name: /diagrama do em \(mi menor\)/i })
        expect(image).toHaveAccessibleName(/corda 5 casa 2, dedo 2/)
        expect(image).toHaveAccessibleName(/corda 4 casa 2, dedo 3/)
    })

    it('desenha seis cordas e cinco casas mais a pestana', () => {
        const { container } = render(<ChordDiagram chord={chordById('Em')} />)
        expect(container.querySelectorAll('.chord-diagram-string')).toHaveLength(6)
        expect(container.querySelectorAll('.chord-diagram-fret')).toHaveLength(6)
    })

    it('marca um ponto com o número do dedo em cada corda apertada', () => {
        render(<ChordDiagram chord={chordById('Em')} />)
        const image = screen.getByRole('img')
        const dots = image.querySelectorAll('.chord-diagram-dot')
        expect(dots).toHaveLength(2)
        const labels = [...image.querySelectorAll('.chord-diagram-finger')].map((node) => node.textContent)
        expect(labels).toEqual(['2', '3'])
    })

    it('cordas abafadas ganham um x e soltas um círculo, em cima da pestana', () => {
        const { container } = render(<ChordDiagram chord={chordById('D')} />)
        expect(container.querySelectorAll('.chord-diagram-muted')).toHaveLength(2)
        expect(container.querySelectorAll('.chord-diagram-open')).toHaveLength(1)
        expect(container.querySelectorAll('.chord-diagram-dot')).toHaveLength(3)
    })

    it.each(['Em', 'Am', 'D', 'C', 'G'] as const)(
        'o %s tem um ponto por corda apertada e um marcador por corda solta ou abafada',
        (id) => {
            const chord = chordById(id)
            const { container } = render(<ChordDiagram chord={chord} />)
            const specs = Object.values(chord.strings)
            expect(container.querySelectorAll('.chord-diagram-dot')).toHaveLength(
                specs.filter((spec) => spec.kind === 'fret').length,
            )
            expect(
                container.querySelectorAll('.chord-diagram-muted, .chord-diagram-open'),
            ).toHaveLength(specs.filter((spec) => spec.kind !== 'fret').length)
        },
    )

    it('o nome do acorde aparece como legenda visível', () => {
        render(<ChordDiagram chord={chordById('G')} />)
        expect(within(screen.getByRole('figure')).getByText('G')).toBeVisible()
    })
})
