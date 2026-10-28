import { DEFAULT_PHYSICS } from '@guess-my-move/marbles'
import { useEffect, useRef } from 'react'

import { CameraPanel } from '../camera/CameraPanel.js'
import { type GetUserMedia } from '../camera/cameraService.js'
import { useCamera } from '../camera/useCamera.js'
import { HandOverlay } from '../round/HandOverlay.js'
import { drawField } from './fieldView.js'
import { MarblesDebugPanel } from './MarblesDebugPanel.js'
import { type MarblesMode } from './marblesController.js'
import { type MarblesDeps, useMarblesGame } from './useMarblesGame.js'

export interface MarblesScreenProps {
    /** `getUserMedia` injetável para teste (o navegador resolve por padrão). */
    cameraGetUserMedia?: GetUserMedia | null
    deps?: MarblesDeps
}

type Round = ReturnType<typeof useMarblesGame>['round']
type TrackerStatus = ReturnType<typeof useMarblesGame>['trackerStatus']

function statusText(
    round: Round,
    tracker: TrackerStatus,
    handVisible: boolean,
    mode: MarblesMode,
): string {
    switch (round.state) {
        case 'idle':
            return tracker === 'loading'
                ? 'Carregando o detector de mão…'
                : 'Ative a câmera para jogar.'
        case 'ready':
            if (handVisible && mode === 'flick') {
                return 'Estalo (alpha): feche a mão com o polegar preso contra o indicador, aponte-a para o alvo e estique o polegar de uma vez, deixando-o esticado. A força vem da rapidez com que o polegar estica.'
            }
            return handVisible
                ? 'Mão à vista! Faça a pinça em qualquer ponto, arraste a mão para longe do alvo e abra os dedos para atirar.'
                : 'Não estou vendo a sua mão. Mostre-a inteira para a câmera, com a palma voltada para ela, na altura do peito e com boa luz.'
        case 'aiming':
            if (mode === 'flick') {
                return 'Armado! Aponte a mão para o alvo e estique o polegar de uma vez, deixando-o esticado: quanto mais rápido, mais forte o tiro.'
            }
            return round.aim?.shot
                ? 'Arraste para trás e abra a pinça para atirar.'
                : 'Puxe mais para trás: com esse arrasto curto o tiro será cancelado.'
        case 'rolling':
            return 'A bolinha está rolando…'
        case 'hit':
            return `Acertou o alvo em ${round.hitShots ?? round.shots} ${
                (round.hitShots ?? round.shots) === 1 ? 'tiro' : 'tiros'
            }!`
        case 'camera_denied':
            return 'O jogo não pode começar sem a câmera.'
        case 'tracker_error':
            return 'O jogo parou por falha do detector. Use “Nova rodada” para tentar de novo.'
    }
}

/**
 * Tela do bete solo: campo 2D visto de cima, câmera com o esqueleto da mão,
 * contador de tiros e painel de depuração. Todo o processamento é local;
 * nenhuma imagem sai do navegador.
 */
export function MarblesScreen({ cameraGetUserMedia, deps }: MarblesScreenProps) {
    const camera = useCamera(
        cameraGetUserMedia === undefined ? {} : { getUserMedia: cameraGetUserMedia },
    )
    const videoRef = useRef<HTMLVideoElement | null>(null)
    const overlayRef = useRef<HTMLCanvasElement | null>(null)
    const fieldRef = useRef<HTMLCanvasElement | null>(null)
    const game = useMarblesGame({
        cameraActive: camera.isActive,
        cameraFailed:
            camera.status === 'denied' ||
            camera.status === 'unavailable' ||
            camera.status === 'error',
        videoRef,
        overlayRef,
        ...(deps === undefined ? {} : { deps }),
    })

    useEffect(() => {
        if (fieldRef.current) drawField(fieldRef.current, game.round, game.hand)
    }, [game.round, game.hand])

    const { round } = game
    const canRestart = round.state !== 'idle' && round.state !== 'camera_denied'

    return (
        <div className="marbles-screen">
            <header className="app-header">
                <h1>Bolinhas de gude: bete</h1>
                <p>
                    Ative a câmera e atire a bolinha azul no alvo vermelho com a mão, no menor
                    número de tiros. No modo Pinça (padrão), feche polegar e indicador em qualquer
                    ponto, com a mão que preferir, arraste para longe do alvo, como um
                    estilingue, e abra os dedos. O modo Estalo (alpha) imita o tiro real: com o
                    polegar preso contra o indicador, aponte a mão para o alvo e estique o polegar de
                    uma vez; a força vem da rapidez com que ele estica.
                </p>
            </header>

            <p className="privacy-notice" role="note">
                <strong>Privacidade:</strong> o reconhecimento da mão roda no seu navegador.
                Nenhuma imagem da câmera é enviada, gravada ou registrada.
            </p>

            <div className="marbles-layout">
                <section aria-labelledby="field-heading" className="marbles-field-panel">
                    <h2 id="field-heading">Campo</h2>
                    <fieldset className="mode-picker">
                        <legend>Modo de tiro</legend>
                        <label>
                            <input
                                type="radio"
                                name="shot-mode"
                                checked={game.mode === 'pinch'}
                                onChange={() => {
                                    game.setMode('pinch')
                                }}
                            />{' '}
                            Pinça
                        </label>
                        <label>
                            <input
                                type="radio"
                                name="shot-mode"
                                checked={game.mode === 'flick'}
                                onChange={() => {
                                    game.setMode('flick')
                                }}
                            />{' '}
                            Estalo (alpha)
                        </label>
                    </fieldset>
                    <canvas
                        ref={fieldRef}
                        className="marbles-field"
                        width={DEFAULT_PHYSICS.width}
                        height={DEFAULT_PHYSICS.height}
                        role="img"
                        aria-label="Campo do jogo, visto de cima"
                    />
                    <p className="shot-counter" data-testid="shot-counter">
                        Tiros: {round.shots}
                    </p>
                    <p aria-live="polite" className="round-status" data-testid="game-status">
                        {statusText(round, game.trackerStatus, game.debug.handVisible, game.mode)}
                    </p>
                    {round.state === 'tracker_error' && (
                        <p className="round-error" role="alert">
                            O detector de mão falhou: {round.failureReason}
                        </p>
                    )}
                    <div className="round-actions">
                        <button type="button" onClick={game.newRound} disabled={!canRestart}>
                            Nova rodada
                        </button>
                    </div>
                </section>

                <div className="marbles-side">
                    <CameraPanel
                        camera={camera}
                        videoRef={videoRef}
                        overlay={<HandOverlay canvasRef={overlayRef} />}
                    />

                    <MarblesDebugPanel debug={game.debug} state={round.state} mode={game.mode} />
                </div>
            </div>
        </div>
    )
}
