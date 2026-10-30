import { type BoardPlacement, DEFAULT_PLACEMENT, STRING_NUMBERS } from '@guess-my-move/guitar'

import { Button } from '../design/index.js'
import { type GuitarController, type GuitarSnapshot } from './guitarController.js'

const DASH = '—'

const decimal = (value: number, digits = 2) =>
    value.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })
/** Tempo em ms; o navegador informa 0 quando não sabe medir, e isso não é latência zero. */
const millis = (seconds: number | null) =>
    seconds === null || seconds <= 0 ? DASH : `${Math.round(seconds * 1000)} ms`

interface SliderSpec {
    key: 'x' | 'y' | 'width' | 'height'
    label: string
    min: number
    max: number
}

const SLIDERS: readonly SliderSpec[] = [
    { key: 'x', label: 'Posição horizontal do braço', min: 0, max: 0.4 },
    { key: 'y', label: 'Posição vertical do braço', min: 0.1, max: 0.7 },
    { key: 'width', label: 'Comprimento do braço', min: 0.4, max: 0.75 },
    { key: 'height', label: 'Espaçamento entre as cordas', min: 0.1, max: 0.32 },
]

/**
 * Depuração e ajuste: o que o reconhecimento está lendo (para calibrar ao vivo) e o ajuste de
 * posição e tamanho do braço. Apenas números locais; nada é enviado nem gravado.
 */
export function GuitarDebugPanel({
    snapshot,
    controller,
}: {
    snapshot: GuitarSnapshot
    controller: GuitarController
}) {
    const { debug, placement } = snapshot
    const setPlacement = (patch: Partial<BoardPlacement>) => {
        controller.setPlacement({ ...placement, ...patch })
    }
    return (
        <section aria-labelledby="guitar-debug-heading" className="debug-panel guitar-debug">
            <h2 id="guitar-debug-heading">Depuração</h2>
            <dl className="debug-grid">
                <dt>Mãos à vista</dt>
                <dd>{snapshot.handsVisible}</dd>
                <dt>Delegate</dt>
                <dd>{debug.delegate ?? DASH}</dd>
                <dt>Quadros por segundo</dt>
                <dd>{debug.fps > 0 ? decimal(debug.fps, 0) : DASH}</dd>
                <dt>Velocidade da batida</dt>
                <dd>{decimal(debug.strumSpeed)} mãos/s</dd>
                <dt>Latência de saída do áudio</dt>
                <dd>
                    {millis(debug.latency.output)} (base {millis(debug.latency.base)})
                </dd>
                {debug.fingers.map((finger) => (
                    <FingerRow key={finger.finger} finger={finger} />
                ))}
                {STRING_NUMBERS.map((string) => {
                    const press = snapshot.presses.find((item) => item.string === string)
                    return (
                        <StringRow
                            key={string}
                            string={string}
                            detected={press?.fret ?? 0}
                        />
                    )
                })}
            </dl>

            <fieldset className="guitar-adjust">
                <legend>Ajuste do braço</legend>
                {SLIDERS.map((slider) => {
                    const id = `guitar-adjust-${slider.key}`
                    return (
                        <div key={slider.key} className="guitar-adjust-row">
                            <label htmlFor={id}>{slider.label}</label>
                            <input
                                id={id}
                                type="range"
                                min={slider.min}
                                max={slider.max}
                                step={0.01}
                                value={placement[slider.key]}
                                onChange={(event) => {
                                    setPlacement({ [slider.key]: Number(event.target.value) })
                                }}
                            />
                            <output htmlFor={id}>{decimal(placement[slider.key])}</output>
                        </div>
                    )
                })}
                <Button
                    variant="secondary"
                    onClick={() => {
                        controller.setPlacement(DEFAULT_PLACEMENT)
                    }}
                >
                    Restaurar o ajuste padrão
                </Button>
            </fieldset>
        </section>
    )
}

function FingerRow({ finger }: { finger: GuitarSnapshot['debug']['fingers'][number] }) {
    const where = finger.cell ? `corda ${finger.cell.string}, casa ${finger.cell.fret}` : DASH
    return (
        <>
            <dt>Dedo {finger.finger}</dt>
            <dd>
                {where}
                {finger.cell ? (finger.pressed ? ' (apertando)' : ' (passando)') : ''}
            </dd>
        </>
    )
}

function StringRow({ string, detected }: { string: number; detected: number }) {
    return (
        <>
            <dt>Corda {string}</dt>
            <dd>{detected === 0 ? 'solta' : `casa ${detected}`}</dd>
        </>
    )
}
