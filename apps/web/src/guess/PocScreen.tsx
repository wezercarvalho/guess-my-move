import { type CardPublicProjection } from '@guess-my-move/core'
import { useRef } from 'react'

import { CameraPanel } from '../camera/CameraPanel.js'
import { type GetUserMedia } from '../camera/cameraService.js'
import { useCamera } from '../camera/useCamera.js'
import { ExternalProviderNotice } from '../capture/ExternalProviderNotice.js'
import { CardView } from './CardView.js'
import { type GuessFlowDeps, useGuessFlow } from './useGuessFlow.js'

/** Props da tela da PoC: a carta pública e deps injetáveis para teste. */
export interface PocScreenProps {
    card: CardPublicProjection
    /** `getUserMedia` injetável para teste (o navegador resolve por padrão). */
    cameraGetUserMedia?: GetUserMedia | null
    flowDeps?: GuessFlowDeps
}

/**
 * Tela da PoC: carta Acenar (apenas o público), câmera, captura e exibição do
 * palpite. Estados `capturing | processing | success | error` diferenciados e
 * anunciados por `aria-live`. Nunca promete tempo real; nunca confunde um erro
 * técnico com um palpite.
 */
export function PocScreen({
    card,
    cameraGetUserMedia,
    flowDeps,
}: PocScreenProps) {
    const camera = useCamera(
        cameraGetUserMedia === undefined
            ? {}
            : { getUserMedia: cameraGetUserMedia },
    )
    const videoRef = useRef<HTMLVideoElement | null>(null)
    const flow = useGuessFlow(flowDeps ?? {})

    const busy = flow.phase === 'capturing' || flow.phase === 'processing'

    const handleCapture = () => {
        void flow.captureAndGuess(videoRef.current)
    }

    return (
        <div className="poc-screen">
            <ExternalProviderNotice />
            <CardView card={card} />
            <CameraPanel camera={camera} videoRef={videoRef} />

            <section aria-labelledby="attempt-heading" className="attempt-panel">
                <h2 id="attempt-heading">Tentativa</h2>

                <div className="attempt-actions">
                    <button
                        type="button"
                        onClick={handleCapture}
                        disabled={!camera.isActive || busy}
                    >
                        {flow.phase === 'capturing'
                            ? 'Capturando…'
                            : flow.phase === 'processing'
                              ? 'Adivinhando…'
                              : 'Capturar e adivinhar'}
                    </button>

                    {busy && (
                        <button type="button" onClick={flow.cancel}>
                            Cancelar
                        </button>
                    )}

                    {(flow.phase === 'success' || flow.phase === 'error') && (
                        <button type="button" onClick={flow.reset}>
                            Tentar novamente
                        </button>
                    )}
                </div>

                {/* Anúncio de estado para tecnologias assistivas. */}
                <p
                    className="sr-only"
                    aria-live="polite"
                    data-testid="attempt-status"
                >
                    {phaseLabel(flow.phase)}
                </p>

                {/* Região viva para o resultado e os erros. */}
                <div aria-live="polite" className="attempt-result">
                    {flow.phase === 'success' && flow.result && (
                        <div className="attempt-success" data-testid="guess-result">
                            {flow.result.insufficientEvidence ? (
                                <p>
                                    O provedor não teve evidência suficiente
                                    para um palpite.
                                </p>
                            ) : (
                                <p>
                                    Palpite da IA:{' '}
                                    <strong>{flow.result.guess}</strong>
                                </p>
                            )}
                            <p className="attempt-duration">
                                Tentativa concluída em{' '}
                                {formatDuration(flow.result.durationMs)}.
                            </p>
                        </div>
                    )}

                    {flow.phase === 'error' && flow.errorMessage && (
                        <div className="attempt-error" role="alert">
                            <p>{flow.errorMessage}</p>
                            <p className="attempt-error-hint">
                                A câmera continua ativa — você pode tentar de
                                novo.
                            </p>
                        </div>
                    )}
                </div>
            </section>
        </div>
    )
}

/** Rótulo textual do estado da tentativa, para o `aria-live`. */
function phaseLabel(phase: ReturnType<typeof useGuessFlow>['phase']): string {
    switch (phase) {
        case 'idle':
            return 'Pronto para capturar.'
        case 'capturing':
            return 'Capturando os frames.'
        case 'processing':
            return 'Enviando ao provedor e aguardando o palpite.'
        case 'success':
            return 'Palpite recebido.'
        case 'error':
            return 'A tentativa falhou. É possível tentar novamente.'
    }
}

/** Formata uma duração em ms como segundos legíveis em pt-BR. */
function formatDuration(ms: number): string {
    const seconds = ms / 1000
    return `${seconds.toLocaleString('pt-BR', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    })} s`
}
