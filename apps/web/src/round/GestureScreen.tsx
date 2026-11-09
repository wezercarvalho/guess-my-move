import { useI18n } from '../i18n/locale.js'
import { type Card, toPublicCard } from '@guess-my-move/core'
import { useRef } from 'react'

import { CameraPanel } from '../camera/CameraPanel.js'
import { type GetUserMedia } from '../camera/cameraService.js'
import { useCamera } from '../camera/useCamera.js'
import { CardView } from '../card/CardView.js'
import { DebugPanel } from './DebugPanel.js'
import { PrivacyNotice } from '../shared/PrivacyNotice.js'
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
    const { t, locale } = useI18n()
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
            <PrivacyNotice />

            <CardView card={publicCard} />
            <CameraPanel
                camera={camera}
                videoRef={videoRef}
                overlay={<HandOverlay canvasRef={overlayRef} />}
            />

            <section aria-labelledby="round-heading" className="round-panel">
                <h2 id="round-heading">{t.round}</h2>

                <p className="round-status" data-testid="round-status">
                    {statusText(round.state, round.trackerStatus, t)}
                </p>

                <div className="round-actions">
                    <button type="button" onClick={round.start} disabled={!round.canStart}>
                        {t.start}
                    </button>
                    {detecting && (
                        <button type="button" onClick={round.cancel}>
                            {t.cancel}
                        </button>
                    )}
                    {round.finished && (
                        <button type="button" onClick={round.newRound}>
                            {t.newRound}
                        </button>
                    )}
                    {detecting && remainingSeconds !== null && (
                        <span className="round-timer" data-testid="round-timer">
                            {remainingSeconds} s
                        </span>
                    )}
                </div>

                <div aria-live="polite" className="round-result" data-testid="round-result">
                    {resultText(round.state, round.elapsedMs, round.maxDurationMs, t, locale)}
                </div>

                {round.state === 'tracker_error' && (
                    <div className="round-error" role="alert">
                        <p>{t.trackerFailed} {round.failureReason}</p>
                        <p className="round-error-hint">
                            {t.trackerRetry}
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
    t: ReturnType<typeof useI18n>['t'],
): string {
    switch (state) {
        case 'idle':
        case 'card_revealed':
            return tracker === 'loading'
                ? t.trackerLoading
                : t.enableToStart
        case 'camera_ready':
            return t.ready
        case 'detecting':
            return t.detecting
        case 'recognized':
        case 'timed_out':
        case 'user_cancelled':
        case 'tracker_error':
            return t.ended
        case 'camera_denied':
            return t.cameraRequired
    }
}

function resultText(
    state: ReturnType<typeof useGestureRound>['state'],
    elapsedMs: number | null,
    maxDurationMs: number,
    t: ReturnType<typeof useI18n>['t'],
    locale: string,
): string {
    switch (state) {
        case 'recognized':
            return `${t.recognized} ${formatSeconds(elapsedMs ?? 0, locale)}.`
        case 'timed_out':
            return `${t.timeout} ${formatSeconds(maxDurationMs, locale)}. ${t.retry}`
        case 'user_cancelled':
            return t.cancelled
        default:
            return ''
    }
}

function formatSeconds(ms: number, locale: string): string {
    return `${(ms / 1000).toLocaleString(locale, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    })} s`
}
