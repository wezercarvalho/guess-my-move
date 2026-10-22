import { type Card, toPublicCard } from '@guess-my-move/core'
import { useRef } from 'react'

import { CameraPanel } from '../camera/CameraPanel.js'
import { type GetUserMedia } from '../camera/cameraService.js'
import { useCamera } from '../camera/useCamera.js'
import { ExternalProviderNotice } from '../capture/ExternalProviderNotice.js'
import { CardView } from './CardView.js'
import {
    type AttemptPhase,
    type AttemptVerdict,
    DEFAULT_MAX_ATTEMPTS,
    type GuessFlowDeps,
    useRoundFlow,
} from './useRoundFlow.js'

/**
 * Props da tela da PoC. A carta completa serve ao motor da rodada (que julga o
 * palpite); a tela exibe só a projeção pública e o adivinhador nunca a recebe.
 */
export interface PocScreenProps {
    card: Card
    /** Tentativas válidas por rodada (padrão: 3). */
    maxAttempts?: number
    /** `getUserMedia` injetável para teste (o navegador resolve por padrão). */
    cameraGetUserMedia?: GetUserMedia | null
    flowDeps?: GuessFlowDeps
}

/**
 * Tela da PoC: carta Acenar (apenas o público), câmera, captura e uma rodada
 * completa (palpite da IA, veredito do árbitro, novas tentativas com os
 * rejeitados e nova rodada). Estados `capturing | processing | result | error`
 * diferenciados e anunciados por `aria-live`. Nunca promete tempo real; nunca
 * confunde um erro técnico com um palpite.
 */
export function PocScreen({
    card,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    cameraGetUserMedia,
    flowDeps,
}: PocScreenProps) {
    const camera = useCamera(
        cameraGetUserMedia === undefined
            ? {}
            : { getUserMedia: cameraGetUserMedia },
    )
    const videoRef = useRef<HTMLVideoElement | null>(null)
    const flow = useRoundFlow(card, flowDeps ?? {}, maxAttempts)
    const publicCard = toPublicCard(card)

    const busy = flow.phase === 'capturing' || flow.phase === 'processing'
    const { round } = flow

    const handleCapture = () => {
        void flow.captureAndGuess(videoRef.current)
    }

    return (
        <div className="poc-screen">
            <ExternalProviderNotice />
            <CardView key={round.roundNumber} card={publicCard} />
            <CameraPanel camera={camera} videoRef={videoRef} />

            <section aria-labelledby="attempt-heading" className="attempt-panel">
                <h2 id="attempt-heading">Tentativa</h2>

                <p className="round-status" data-testid="round-status">
                    Tentativas: {round.attempts} de {round.maxAttempts}
                </p>

                <div className="attempt-actions">
                    <button
                        type="button"
                        onClick={handleCapture}
                        disabled={!camera.isActive || busy || round.finished}
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

                    {flow.phase === 'error' && (
                        <button type="button" onClick={flow.reset}>
                            Tentar novamente
                        </button>
                    )}

                    {!busy && (round.attempts > 0 || round.finished) && (
                        <button type="button" onClick={flow.newRound}>
                            Nova rodada
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
                    {flow.phase === 'result' && flow.result && (
                        <div className="attempt-success" data-testid="guess-result">
                            {flow.result.verdict === 'insufficient' ? (
                                <p>
                                    O provedor não teve evidência suficiente
                                    para um palpite. A tentativa não foi
                                    contada.
                                </p>
                            ) : (
                                <>
                                    <p>
                                        Palpite da IA:{' '}
                                        <strong>{flow.result.guess}</strong>
                                    </p>
                                    <p
                                        className={`round-verdict round-verdict-${flow.result.verdict}`}
                                        data-testid="round-verdict"
                                    >
                                        {verdictMessage(flow.result.verdict)}
                                    </p>
                                </>
                            )}
                            <p className="attempt-duration">
                                Tentativa concluída em{' '}
                                {formatDuration(flow.result.durationMs)}.
                            </p>
                        </div>
                    )}

                    {round.rejectedGuesses.length > 0 && (
                        <p
                            className="rejected-guesses"
                            data-testid="rejected-guesses"
                        >
                            Palpites já rejeitados:{' '}
                            {round.rejectedGuesses.join(', ')}
                        </p>
                    )}

                    {flow.phase === 'error' && flow.errorMessage && (
                        <div className="attempt-error" role="alert">
                            <p>{flow.errorMessage}</p>
                            <p className="attempt-error-hint">
                                A câmera continua ativa — você pode tentar de
                                novo. A tentativa não foi contada.
                            </p>
                        </div>
                    )}
                </div>
            </section>
        </div>
    )
}

/** Rótulo textual do estado da tentativa, para o `aria-live`. */
function phaseLabel(phase: AttemptPhase): string {
    switch (phase) {
        case 'idle':
            return 'Pronto para capturar.'
        case 'capturing':
            return 'Capturando os frames.'
        case 'processing':
            return 'Enviando ao provedor e aguardando o palpite.'
        case 'result':
            return 'Palpite recebido e julgado.'
        case 'error':
            return 'A tentativa falhou. É possível tentar novamente.'
    }
}

/** Mensagem do veredito do árbitro para a rodada. */
function verdictMessage(verdict: Exclude<AttemptVerdict, 'insufficient'>): string {
    switch (verdict) {
        case 'correct':
            return 'Acertou! A IA adivinhou a carta.'
        case 'retry':
            return 'Não foi dessa vez. Capture de novo para outra tentativa.'
        case 'finished':
            return 'Fim da rodada: as tentativas acabaram sem acerto.'
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
