import { type HandDebug, type SwingSnapshot } from './swingController.js'

const num = (value: number) => value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Em contato com a parede, agarrado e o sinal de escalada (-1..1), para a depuração do agarre. */
type GrabDebug = SwingSnapshot['grabDebug']

const yesNo = (value: boolean) => (value ? 'sim' : 'não')

/**
 * Leitura de cada mão: o alcance de cada dedo (esticado passa de 1,50; dobrado fica abaixo de
 * 1,30), o quanto o polegar se abre (a pose pede 0,60 ou mais) e o gesto que o jogo entendeu.
 * Serve para ver por que uma pose não foi reconhecida. O resumo do agarre mostra o contato com
 * a parede, se o jogador está agarrado e o sinal de escalada.
 */
export function SwingDebugPanel({ hands, grab }: { hands: readonly HandDebug[]; grab: GrabDebug }) {
    return (
        <section aria-labelledby="swing-debug-heading" className="debug-panel">
            <h2 id="swing-debug-heading">Depuração</h2>
            <dl className="debug-grid">
                <dt>Em contato com a parede</dt>
                <dd>{yesNo(grab.touchingWall)}</dd>
                <dt>Agarrado</dt>
                <dd>{yesNo(grab.gripped)}</dd>
                <dt>Sinal de escalada (-1..1)</dt>
                <dd>{num(grab.climb)}</dd>
            </dl>
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
                        <dt>Palma aberta (agarrar)</dt>
                        <dd>{yesNo(hand.openPalm)}</dd>
                        <dt>Punho fechado (soltar)</dt>
                        <dd>{yesNo(hand.fist)}</dd>
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
