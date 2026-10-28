import { useEffect, useRef } from 'react'

import { CameraPanel } from '../camera/CameraPanel.js'
import { type GetUserMedia } from '../camera/cameraService.js'
import { useCamera } from '../camera/useCamera.js'
import { Button, Eyebrow, Panel, Steps } from '../design/index.js'
import { HandOverlay } from '../round/HandOverlay.js'
import { PrivacyNotice } from '../shared/PrivacyNotice.js'
import { STEPS, currentStep, guideHint } from './guide.js'
import { type SwingDeps, type SwingGameView, useSwingGame } from './useSwingGame.js'

export interface SwingScreenProps {
    /** `getUserMedia` injetável para teste (o navegador resolve por padrão). */
    cameraGetUserMedia?: GetUserMedia | null
    deps?: SwingDeps
}

/** Uma linha de status: o que fazer agora. Os detalhes ficam no guia ("Como jogar"). */
function statusText(game: SwingGameView): string {
    if (game.phase === 'loading') return 'Carregando a cidade…'
    if (game.phase === 'error') return 'Não foi possível jogar.'
    if (!game.hud.started) return 'Faça o gesto “eu te amo” para saltar.'
    if (game.hud.webAttached) return 'Balançando. Desfaça o gesto para soltar.'
    return 'Faça o gesto “eu te amo” para lançar a teia.'
}

/**
 * Tela do Arranha-Teia: cidade em primeira pessoa, medidores de velocidade e altura, câmera
 * pequena com o esqueleto da mão e o guia. Todo o processamento é local; nenhuma imagem
 * sai do navegador.
 */
export function SwingScreen({ cameraGetUserMedia, deps }: SwingScreenProps) {
    const camera = useCamera(
        cameraGetUserMedia === undefined ? {} : { getUserMedia: cameraGetUserMedia },
    )
    const videoRef = useRef<HTMLVideoElement | null>(null)
    const overlayRef = useRef<HTMLCanvasElement | null>(null)
    const sceneRef = useRef<HTMLCanvasElement | null>(null)
    const effectsRef = useRef<HTMLCanvasElement | null>(null)
    const stageRef = useRef<HTMLDivElement | null>(null)
    const game = useSwingGame({
        cameraActive: camera.isActive,
        videoRef,
        overlayRef,
        sceneRef,
        effectsRef,
        ...(deps === undefined ? {} : { deps }),
    })
    const { resize } = game

    useEffect(() => {
        const stage = stageRef.current
        if (!stage || typeof ResizeObserver === 'undefined') return
        const observer = new ResizeObserver(() => {
            resize(stage.clientWidth, stage.clientHeight)
        })
        observer.observe(stage)
        resize(stage.clientWidth, stage.clientHeight)
        return () => {
            observer.disconnect()
        }
    }, [resize])

    const hint = guideHint({
        cameraActive: camera.isActive,
        trackerStatus: game.trackerStatus,
        handVisible: game.handVisible,
        lastThrow: game.lastThrow,
    })

    return (
        <div className="swing-screen">
            <header className="swing-header">
                <Eyebrow>Passeio livre</Eyebrow>
                <h1>Arranha-Teia</h1>
                <p className="swing-lead">Balance entre os prédios de Midtown com a mão.</p>
            </header>

            <div className="swing-layout">
                <Panel aria-label="Cidade" className="swing-stage-panel">
                    <div ref={stageRef} className="swing-stage">
                        <canvas
                            ref={sceneRef}
                            className="swing-scene"
                            role="img"
                            aria-label="Vista em primeira pessoa de Manhattan"
                        />
                        <canvas ref={effectsRef} className="swing-effects" aria-hidden="true" />
                        <dl className="swing-hud" data-testid="swing-hud">
                            <div>
                                <dt>Velocidade</dt>
                                <dd data-testid="hud-speed">{game.hud.speedKmh} km/h</dd>
                            </div>
                            <div>
                                <dt>Altura</dt>
                                <dd data-testid="hud-altitude">{game.hud.altitude} m</dd>
                            </div>
                        </dl>
                    </div>
                    <p className="swing-credit" data-testid="map-credit">
                        {game.attribution}
                    </p>
                </Panel>

                <div className="swing-side">
                    <Panel raised aria-label="Passeio" className="swing-round">
                        <p className="swing-counter" data-testid="web-counter">
                            Teias: {game.hud.webs}
                        </p>
                        <p className="swing-distance" data-testid="distance">
                            Distância: {game.hud.distance} m
                        </p>
                        <p aria-live="polite" className="round-status" data-testid="game-status">
                            {statusText(game)}
                        </p>
                        {game.phase === 'error' && (
                            <p className="round-error" role="alert">
                                Motivo: {game.failure}
                            </p>
                        )}
                        <Button variant="secondary" onClick={game.restart} disabled={game.phase !== 'playing'}>
                            Voltar ao início
                        </Button>
                    </Panel>
                    <CameraPanel
                        camera={camera}
                        videoRef={videoRef}
                        overlay={<HandOverlay canvasRef={overlayRef} />}
                    />
                    <Panel raised aria-label="Como jogar">
                        <Eyebrow>Como jogar</Eyebrow>
                        <Steps
                            label="Como jogar"
                            items={STEPS}
                            current={currentStep(game.hud.webAttached)}
                        />
                        <p className="guide-hint" data-testid="guide-hint" aria-live="polite">
                            {hint}
                        </p>
                        <p className="swing-keys">Teclado: Espaço lança a teia, setas olham.</p>
                    </Panel>
                    <PrivacyNotice />
                </div>
            </div>
        </div>
    )
}
