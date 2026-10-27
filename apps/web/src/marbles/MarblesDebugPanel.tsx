import { type BeteState } from '@guess-my-move/marbles'

import { type MarblesDebug, type MarblesMode } from './marblesController.js'

const DASH = '—'

const STATE_LABEL: Record<BeteState, string> = {
    idle: 'ocioso',
    ready: 'pronto',
    aiming: 'mirando',
    rolling: 'rolando',
    hit: 'acerto',
    camera_denied: 'câmera negada',
    tracker_error: 'erro do detector',
}

const yesNo = (value: boolean) => (value ? 'sim' : 'não')
const millis = (value: number | null) => (value === null ? DASH : `${Math.round(value)} ms`)

/**
 * Painel de depuração do bete: o que o detector está lendo, para calibrar a
 * pinça. Apenas números locais; nada é enviado nem gravado.
 */
export function MarblesDebugPanel({
    debug,
    state,
    mode = 'pinch',
}: {
    debug: MarblesDebug
    state: BeteState
    mode?: MarblesMode
}) {
    return (
        <section aria-labelledby="marbles-debug-heading" className="debug-panel">
            <h2 id="marbles-debug-heading">Depuração</h2>
            <dl className="debug-grid">
                <dt>Delegate</dt>
                <dd>{debug.delegate ?? DASH}</dd>
                <dt>Estado</dt>
                <dd>{STATE_LABEL[state]}</dd>
                <dt>Razão da pinça</dt>
                <dd>
                    {debug.ratio === null
                        ? DASH
                        : debug.ratio.toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                          })}
                </dd>
                <dt>Pinça fechada</dt>
                <dd>{yesNo(debug.pinchClosed)}</dd>
                <dt>Mão visível</dt>
                <dd>{yesNo(debug.handVisible)}</dd>
                <dt>Quadros processados</dt>
                <dd>{debug.frames}</dd>
                <dt>Latência mediana</dt>
                <dd>{millis(debug.medianMs)}</dd>
                <dt>Latência p95</dt>
                <dd>{millis(debug.p95Ms)}</dd>
                {mode === 'flick' && (
                    <>
                        <dt>Armado</dt>
                        <dd>{yesNo(debug.flick.armed)}</dd>
                        <dt>Velocidade da abertura</dt>
                        <dd>
                            {debug.flick.lastOpenSpeed === null
                                ? DASH
                                : `${debug.flick.lastOpenSpeed.toLocaleString('pt-BR', {
                                      maximumFractionDigits: 1,
                                      minimumFractionDigits: 1,
                                  })} razão/s`}
                        </dd>
                        <dt>Duração da subida</dt>
                        <dd>{millis(debug.flick.lastRiseMs)}</dd>
                        <dt>Resultado do último estalo</dt>
                        <dd>{debug.flick.lastResult ?? DASH}</dd>
                    </>
                )}
            </dl>
        </section>
    )
}
