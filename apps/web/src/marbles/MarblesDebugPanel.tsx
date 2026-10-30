import { type MarblesDebug, type ShotControl } from './marblesController.js'

const DASH = '—'

const yesNo = (value: boolean) => (value ? 'sim' : 'não')
const millis = (value: number | null) => (value === null ? DASH : `${Math.round(value)} ms`)

/**
 * Painel de depuração das bolinhas: o que o detector está lendo, para calibrar
 * a pinça e o estalo. Apenas números locais; nada é enviado nem gravado.
 */
export function MarblesDebugPanel({
    debug,
    shotControl = 'pinch',
}: {
    debug: MarblesDebug
    shotControl?: ShotControl
}) {
    return (
        <section aria-labelledby="marbles-debug-heading" className="debug-panel">
            <h2 id="marbles-debug-heading">Depuração</h2>
            <dl className="debug-grid">
                <dt>Delegate</dt>
                <dd>{debug.delegate ?? DASH}</dd>
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
                <dt>Quadros novos da câmera/s</dt>
                <dd>
                    {debug.cameraFps === null
                        ? DASH
                        : debug.cameraFps.toLocaleString('pt-BR', {
                              minimumFractionDigits: 1,
                              maximumFractionDigits: 1,
                          })}
                </dd>
                <dt>Latência mediana</dt>
                <dd>{millis(debug.medianMs)}</dd>
                <dt>Latência p95</dt>
                <dd>{millis(debug.p95Ms)}</dd>
                {shotControl === 'flick' && (
                    <>
                        <dt>Armado</dt>
                        <dd>{yesNo(debug.flick.armed)}</dd>
                        <dt>Gesto reconhecido</dt>
                        <dd>
                            {debug.flick.gesture === null
                                ? DASH
                                : `${debug.flick.gesture.name} (${Math.round(debug.flick.gesture.score * 100)}%)`}
                        </dd>
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
                        <dt>Força do último estalo</dt>
                        <dd>
                            {debug.flick.lastPower === null
                                ? DASH
                                : `${Math.round(debug.flick.lastPower * 100)}%`}
                        </dd>
                        <dt>Resultado do último estalo</dt>
                        <dd aria-live="polite">{debug.flick.lastResult ?? DASH}</dd>
                    </>
                )}
            </dl>
        </section>
    )
}
