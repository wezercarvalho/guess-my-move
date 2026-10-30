import { type HandDebug, type HeadDebug } from './swingController.js'

const num = (value: number) => value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * Leitura de cada mão: o alcance de cada dedo (esticado passa de 1,50; dobrado fica abaixo de
 * 1,30), o quanto o polegar se abre (a pose pede 0,60 ou mais) e o gesto que o jogo entendeu.
 * Mais a leitura da cabeça (ângulos aplicados ao olhar, calibrado e rosto visível). Serve
 * para ver por que uma pose não foi reconhecida ou por que a câmera não gira com a cabeça.
 */
export function SwingDebugPanel({ hands, head }: { hands: readonly HandDebug[]; head?: HeadDebug }) {
    return (
        <section aria-labelledby="swing-debug-heading" className="debug-panel">
            <h2 id="swing-debug-heading">Depuração</h2>
            {head ? (
                <dl className="debug-grid" data-testid="head-debug">
                    <dt>Direção do olhar</dt>
                    <dd>{head.lookMode === 'face' ? 'rosto' : 'automática'}</dd>
                    <dt>Rosto</dt>
                    <dd>{head.faceVisible ? 'à vista' : 'ausente'}</dd>
                    <dt>Calibrado</dt>
                    <dd>{head.calibrated ? 'sim' : 'não'}</dd>
                    <dt>Cabeça (guinada)</dt>
                    <dd>{head.yawDeg}°</dd>
                    <dt>Cabeça (inclinação)</dt>
                    <dd>{head.pitchDeg}°</dd>
                </dl>
            ) : null}
            {hands.length === 0 ? (
                <p>Nenhuma mão à vista.</p>
            ) : (
                hands.map((hand) => (
                    <dl key={hand.side} className="debug-grid">
                        <dt>Mão</dt>
                        <dd>{hand.side}</dd>
                        <dt>Gesto entendido</dt>
                        <dd>{hand.signal ?? '—'}</dd>
                        <dt>Rótulo do reconhecedor</dt>
                        <dd>{hand.label ?? '—'}</dd>
                        {hand.metrics ? (
                            <>
                                <dt>Indicador</dt>
                                <dd>{num(hand.metrics.index)}</dd>
                                <dt>Médio</dt>
                                <dd>{num(hand.metrics.middle)}</dd>
                                <dt>Anelar</dt>
                                <dd>{num(hand.metrics.ring)}</dd>
                                <dt>Mindinho</dt>
                                <dd>{num(hand.metrics.pinky)}</dd>
                                <dt>Polegar aberto</dt>
                                <dd>{num(hand.metrics.thumb)}</dd>
                            </>
                        ) : (
                            <>
                                <dt>Medidas</dt>
                                <dd>—</dd>
                            </>
                        )}
                    </dl>
                ))
            )}
        </section>
    )
}
