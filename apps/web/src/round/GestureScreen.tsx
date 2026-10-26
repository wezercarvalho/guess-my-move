import { type Card, toPublicCard } from '@guess-my-move/core'
import { useRef } from 'react'

import { CameraPanel } from '../camera/CameraPanel.js'
import { type GetUserMedia } from '../camera/cameraService.js'
import { useCamera } from '../camera/useCamera.js'
import { CardView } from '../card/CardView.js'
import { DebugPanel } from './DebugPanel.js'
import { HandOverlay } from './HandOverlay.js'
import { type GestureRoundDeps, useGestureRound } from './useGestureRound.js'

/** Props da tela: a carta completa fica no motor; a tela exibe só a projeção pública. */
export interface GestureScreenProps {
    card: Card
    /** `getUserMedia` injetável para teste (o navegador resolve por padrão). */
    cameraGetUserMedia?: GetUserMedia | null
    deps?: GestureRoundDeps
}

/**
 * Tela da rodada: carta pública, câmera com o esqueleto da mão, botão Começar e
 * o resultado do reconhecimento, mais o painel de depuração. Todo o
 * processamento é local; nenhuma imagem sai do navegador.
 */
export function GestureScreen({ card, cameraGetUserMedia, deps }: GestureScreenProps) {
    const camera = useCamera(
        cameraGetUserMedia === undefined ? {} : { getUserMedia: cameraGetUserMedia },
    )
    const videoRef = useRef<HTMLVideoElement | null>(null)
    const overlayRef = useRef<HTMLCanvasElement | null>(null)
    const round = useGestureRound({
        card,
        cameraActive: camera.isActive,
        cameraFailed:
            camera.status === 'denied' ||
            camera.status === 'unavailable' ||
            camera.status === 'error',
        videoRef,
        overlayRef,
        ...(deps === undefined ? {} : { deps }),
    })
    const publicCard = toPublicCard(card)
    const detecting = round.state === 'detecting'
    const remainingSeconds =
        round.elapsedMs === null
            ? null
            : Math.max(0, Math.ceil((round.maxDurationMs - round.elapsedMs) / 1000))

    return (
        <div className="gesture-screen">
            <p className="privacy-notice" role="note">
                <strong>Privacidade:</strong> o reconhecimento do gesto roda no seu
                navegador. Nenhuma imagem da câmera é enviada, gravada ou registrada.
            </p>

            <CardView card={publicCard} />
            <CameraPanel
                camera={camera}
                videoRef={videoRef}
                overlay={<HandOverlay canvasRef={overlayRef} />}
            />

            <section aria-labelledby="round-heading" className="round-panel">
                <h2 id="round-heading">Rodada</h2>

                <p className="round-status" data-testid="round-status">
                    {statusText(round.state, round.trackerStatus)}
                </p>

                <div className="round-actions">
                    <button type="button" onClick={round.start} disabled={!round.canStart}>
                        Começar
                    </button>
                    {detecting && (
                        <button type="button" onClick={round.cancel}>
                            Cancelar
                        </button>
                    )}
                    {round.finished && (
                        <button type="button" onClick={round.newRound}>
                            Nova rodada
                        </button>
                    )}
                    {detecting && remainingSeconds !== null && (
                        <span className="round-timer" data-testid="round-timer">
                            {remainingSeconds} s
                        </span>
                    )}
                </div>

                <div aria-live="polite" className="round-result" data-testid="round-result">
                    {resultText(round.state, round.elapsedMs, round.maxDurationMs)}
                </div>

                {round.state === 'tracker_error' && (
                    <div className="round-error" role="alert">
                        <p>O detector de mão falhou: {round.failureReason}</p>
                        <p className="round-error-hint">
                            A câmera continua ativa. Use “Nova rodada” para tentar de novo.
                        </p>
                    </div>
                )}
            </section>

            <DebugPanel debug={round.debug} />
        </div>
    )
}

function statusText(
    state: ReturnType<typeof useGestureRound>['state'],
    tracker: ReturnType<typeof useGestureRound>['trackerStatus'],
): string {
    switch (state) {
        case 'idle':
        case 'card_revealed':
            return tracker === 'loading'
                ? 'Carregando o detector de mão…'
                : 'Ative a câmera para começar.'
        case 'camera_ready':
            return 'Pronto. Aperte Começar e faça o gesto da carta.'
        case 'detecting':
            return 'Faça o gesto da carta diante da câmera.'
        case 'recognized':
        case 'timed_out':
        case 'user_cancelled':
        case 'tracker_error':
            return 'Rodada encerrada.'
        case 'camera_denied':
            return 'A rodada não pode começar sem a câmera.'
    }
}

function resultText(
    state: ReturnType<typeof useGestureRound>['state'],
    elapsedMs: number | null,
    maxDurationMs: number,
): string {
    switch (state) {
        case 'recognized':
            return `Gesto reconhecido em ${formatSeconds(elapsedMs ?? 0)}.`
        case 'timed_out':
            return `Gesto não reconhecido em ${formatSeconds(maxDurationMs)}. Tente de novo.`
        case 'user_cancelled':
            return 'Rodada cancelada.'
        default:
            return ''
    }
}

function formatSeconds(ms: number): string {
    return `${(ms / 1000).toLocaleString('pt-BR', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    })} s`
}
