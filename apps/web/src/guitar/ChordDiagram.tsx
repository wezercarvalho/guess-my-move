import { type Chord, FRET_COUNT, STRING_NUMBERS } from '@guess-my-move/guitar'

import { chordDescription } from './guide.js'

const LEFT = 22
const STRING_GAP = 15
const TOP = 34
const FRET_GAP = 20
const DOT_RADIUS = 7

/** Posição horizontal da corda: a 6 fica à esquerda, como nos diagramas de acorde. */
const stringX = (string: number) => LEFT + (6 - string) * STRING_GAP

/**
 * Diagrama clássico do acorde: cordas na vertical (a 6 à esquerda), pestana no alto, cinco
 * casas, ponto com o número do dedo nas cordas apertadas e marca de corda solta (círculo) ou
 * abafada (x) em cima. O nome acessível descreve cada corda em texto.
 */
export function ChordDiagram({ chord }: { chord: Chord }) {
    const width = LEFT * 2 + STRING_GAP * 5
    const height = TOP + FRET_GAP * FRET_COUNT + 10
    const bottom = TOP + FRET_GAP * FRET_COUNT
    return (
        <figure className="chord-diagram">
            <svg
                role="img"
                aria-label={chordDescription(chord)}
                viewBox={`0 0 ${width} ${height}`}
                width={width}
                height={height}
            >
                {Array.from({ length: FRET_COUNT + 1 }, (_, index) => (
                    <line
                        key={`fret-${index}`}
                        className={index === 0 ? 'chord-diagram-fret chord-diagram-nut' : 'chord-diagram-fret'}
                        x1={stringX(6)}
                        x2={stringX(1)}
                        y1={TOP + index * FRET_GAP}
                        y2={TOP + index * FRET_GAP}
                    />
                ))}
                {STRING_NUMBERS.map((string) => (
                    <line
                        key={`string-${string}`}
                        className="chord-diagram-string"
                        x1={stringX(string)}
                        x2={stringX(string)}
                        y1={TOP}
                        y2={bottom}
                    />
                ))}
                {STRING_NUMBERS.map((string) => {
                    const spec = chord.strings[string]
                    const x = stringX(string)
                    if (spec.kind === 'muted') {
                        return (
                            <path
                                key={`mark-${string}`}
                                className="chord-diagram-muted"
                                d={`M${x - 4} ${TOP - 14} L${x + 4} ${TOP - 6} M${x + 4} ${TOP - 14} L${x - 4} ${TOP - 6}`}
                            />
                        )
                    }
                    if (spec.kind === 'open') {
                        return (
                            <circle
                                key={`mark-${string}`}
                                className="chord-diagram-open"
                                cx={x}
                                cy={TOP - 10}
                                r={4}
                            />
                        )
                    }
                    const y = TOP + (spec.fret - 0.5) * FRET_GAP
                    return (
                        <g key={`dot-${string}`}>
                            <circle className="chord-diagram-dot" cx={x} cy={y} r={DOT_RADIUS} />
                            <text
                                className="chord-diagram-finger"
                                x={x}
                                y={y}
                                textAnchor="middle"
                                dominantBaseline="central"
                            >
                                {spec.finger}
                            </text>
                        </g>
                    )
                })}
            </svg>
            <figcaption>{chord.name}</figcaption>
        </figure>
    )
}
