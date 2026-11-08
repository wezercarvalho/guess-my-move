import type { CardPublicProjection } from '@guess-my-move/core'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { CameraPanel } from '../camera/CameraPanel.js'
import { useCamera } from '../camera/useCamera.js'
import { CardView } from '../card/CardView.js'
import { Notice } from '../design/index.js'
import { useI18n } from '../i18n/locale.js'
import { HandOverlay } from '../round/HandOverlay.js'
import {
    createMediaPipeHandTracker,
    delegatePreferenceFromSearch,
    realMediaPipeLoader,
} from '../tracker/mediapipeTracker.js'
import { CompetitionController } from './competitionController.js'
import { createCardRoundApi } from './roundApi.js'

/** Mounted by card/locale; unmount releases camera, detector, frames and pending requests. */
export function CompetitiveScreen({ card }: { card: CardPublicProjection }) {
    const { t, locale } = useI18n()
    const camera = useCamera()
    const video = useRef<HTMLVideoElement | null>(null)
    const overlay = useRef<HTMLCanvasElement | null>(null)
    const [controller] = useState(
        () =>
            new CompetitionController({
                cardId: card.id,
                locale,
                api: createCardRoundApi(),
                env: {
                    now: () => performance.now(),
                    requestFrame: (callback) => requestAnimationFrame(callback),
                    cancelFrame: (handle) => cancelAnimationFrame(handle),
                    createTracker: () =>
                        createMediaPipeHandTracker(
                            realMediaPipeLoader,
                            delegatePreferenceFromSearch(
                                window.location.search,
                            ),
                        ),
                },
            }),
    )
    const game = useSyncExternalStore(
        controller.subscribe,
        controller.getSnapshot,
    )
    useEffect(() => {
        controller.attach({
            getVideo: () => video.current,
            getOverlay: () => overlay.current,
        })
        return () => controller.destroy()
    }, [controller])
    useEffect(
        () => controller.setCamera(camera.isActive),
        [controller, camera.isActive],
    )
    const running = game.status === 'playing' || game.status === 'starting'
    const seconds = (game.remainingMs / 1000).toLocaleString(locale, {
        maximumFractionDigits: 1,
    })
    const elapsed = ((game.round?.elapsedMs ?? 0) / 1000).toLocaleString(
        locale,
        { minimumFractionDigits: 1, maximumFractionDigits: 1 },
    )
    return (
        <div className="gesture-screen">
            <Notice>
                <strong>{t.privacyTitle}</strong> {t.competitivePrivacy}
            </Notice>
            <p>{t.competitiveLimits}</p>
            <CardView card={card} />
            <CameraPanel
                camera={camera}
                videoRef={video}
                overlay={<HandOverlay canvasRef={overlay} />}
            />
            <section className="round-panel" aria-labelledby="round-heading">
                <h2 id="round-heading">{t.round}</h2>
                <p aria-live="polite">
                    {game.status === 'loading'
                        ? t.trackerLoading
                        : game.status === 'starting'
                          ? t.connecting
                          : game.status === 'playing'
                            ? t.detecting
                            : game.canStart
                              ? t.ready
                              : t.enableToStart}
                </p>
                <div className="round-actions">
                    <button
                        type="button"
                        disabled={!game.canStart}
                        onClick={() => void controller.start()}
                    >
                        {game.status === 'finished' ||
                        game.status === 'cancelled' ||
                        game.status === 'error'
                            ? t.newRound
                            : t.start}
                    </button>
                    {running && (
                        <button
                            type="button"
                            onClick={() => controller.cancel()}
                        >
                            {t.cancel}
                        </button>
                    )}
                    {running && (
                        <span className="round-timer" data-testid="round-timer">
                            {seconds} s
                        </span>
                    )}
                </div>
                <div
                    aria-live="polite"
                    className="round-result"
                    data-testid="round-result"
                >
                    {game.status === 'error' && (
                        <p role="alert">
                            {game.failure === 'tracker'
                                ? `${t.trackerFailed} ${t.trackerRestart}`
                                : t.serverError}
                        </p>
                    )}
                    {game.status === 'cancelled' && <p>{t.cancelled}</p>}
                    {game.status === 'finished' && game.round && (
                        <>
                            <p>
                                {game.round.state === 'recognized'
                                    ? `${t.recognized} ${elapsed} s.`
                                    : game.round.state === 'timed_out'
                                      ? `${t.timeout} ${elapsed} s. ${t.retry}`
                                      : t.cancelled}
                            </p>
                            <p>
                                {t.points}:{' '}
                                <output data-testid="competitive-score">
                                    {game.round.score.toLocaleString(locale)}
                                </output>
                            </p>
                            <p>{t.serverAuthority}</p>
                        </>
                    )}
                </div>
            </section>
        </div>
    )
}
