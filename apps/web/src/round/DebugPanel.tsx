import { type DebugInfo } from './debugInfo.js'

const DASH = '—'

const degrees = (value: number | null) =>
    value === null
        ? DASH
        : `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })}°`
const millis = (value: number | null) => (value === null ? DASH : `${Math.round(value)} ms`)

/**
 * Painel de depuração: o que o detector e o avaliador estão lendo, para ajustar
 * os limiares da carta. Apenas números locais; nada é enviado nem gravado.
 */
export function DebugPanel({ debug }: { debug: DebugInfo }) {
    return (
        <section aria-labelledby="debug-heading" className="debug-panel">
            <h2 id="debug-heading">Depuração</h2>
            <dl className="debug-grid">
                <dt>Delegate</dt>
                <dd>{debug.delegate ?? DASH}</dd>
                <dt>Ângulo da mão</dt>
                <dd>{degrees(debug.angleDeg)}</dd>
                <dt>Inversões na janela</dt>
                <dd>{debug.reversals}</dd>
                <dt>Amostras na janela</dt>
                <dd>{debug.windowSamples}</dd>
                <dt>Quadros processados</dt>
                <dd>{debug.frames}</dd>
                <dt>Latência mediana</dt>
                <dd>{millis(debug.medianMs)}</dd>
                <dt>Latência p95</dt>
                <dd>{millis(debug.p95Ms)}</dd>
            </dl>
        </section>
    )
}
