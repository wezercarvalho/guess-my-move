import { useEffect, useRef } from 'react'

import { CameraPanel } from '../camera/CameraPanel.js'
import { type GetUserMedia } from '../camera/cameraService.js'
import { useCamera } from '../camera/useCamera.js'
import { Button, DrawerPanel, DrawerToggle, Eyebrow, Panel, SegmentedControl, Steps, useDrawer } from '../design/index.js'
import { HandOverlay } from '../round/HandOverlay.js'
import { PrivacyNotice } from '../shared/PrivacyNotice.js'
import { DEFAULT_CITY_MAP, type CityMap } from './cityCatalog.js'
import {
    HEAD_IDLE_HINT,
    KEYS,
    STEPS,
    currentStep,
    gripStatusLine,
    guideHint,
    headStatusLine,
    statusLine,
} from './guide.js'
import { SwingDebugPanel } from './SwingDebugPanel.js'
import { type SwingDeps, type SwingGameView, useSwingGame } from './useSwingGame.js'

export interface SwingScreenProps {
    /** Mapa validado pelo catálogo. O default preserva usos/testes anteriores do Midtown. */
    map?: CityMap
    onChangeMap?: () => void
    /** `getUserMedia` injetável para teste (o navegador resolve por padrão). */
    cameraGetUserMedia?: GetUserMedia | null
    deps?: SwingDeps
}

/** Uma linha de status: o que fazer agora. Os detalhes ficam no guia ("Como jogar"). */
function statusText(game: SwingGameView): string {
    if (game.phase === 'loading') return 'Carregando a cidade…'
    if (game.phase === 'error') return 'Não foi possível jogar.'
    if (game.hud.gripped) return gripStatusLine(game.lookMode === 'face' && game.faceVisible ? game.headClimb : null)
    return statusLine(game.cue)
}

const SIDE_NAMES = { '-1': 'esquerda', '0': 'centro', '1': 'direita' } as const

/** Opções do seletor "Direção do olhar": padrão Rosto. */
const LOOK_MODE_OPTIONS = [
    { value: 'face', label: 'Rosto' },
    { value: 'auto', label: 'Automática' },
] as const

/** Mãos com teia presa, para o medidor da tela. */
function webLabel(sides: readonly (-1 | 0 | 1)[]): string {
    if (sides.length === 0) return 'solta'
    if (sides.includes(-1) && sides.includes(1)) return 'as duas'
    return sides.map((side) => SIDE_NAMES[`${side}`]).join(' e ')
}

/**
 * Tela do Arranha-Teia: cidade em primeira pessoa, medidores de velocidade e altura, câmera
 * pequena com o esqueleto da mão e o guia. Todo o processamento é local; nenhuma imagem
 * sai do navegador.
 */
export function SwingScreen({
    map = DEFAULT_CITY_MAP,
    onChangeMap,
    cameraGetUserMedia,
    deps,
}: SwingScreenProps) {
    const camera = useCamera(
        cameraGetUserMedia === undefined ? {} : { getUserMedia: cameraGetUserMedia },
    )
    const videoRef = useRef<HTMLVideoElement | null>(null)
    const overlayRef = useRef<HTMLCanvasElement | null>(null)
    const sceneRef = useRef<HTMLCanvasElement | null>(null)
    const effectsRef = useRef<HTMLCanvasElement | null>(null)
    const stageRef = useRef<HTMLDivElement | null>(null)
    const debugDrawer = useDrawer()
    const game = useSwingGame({
        map,
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
        gestureHeld: game.gestureHeld,
        gripped: game.hud.gripped,
        lastThrow: game.lastThrow,
        cue: game.cue,
    })

    const headStatus = headStatusLine({
        cameraActive: camera.isActive,
        faceTrackerStatus: game.faceTrackerStatus,
        faceVisible: game.faceVisible,
        lockMode: game.headLock.mode,
    })

    return (
        <div className="swing-screen">
            <header className="swing-header">
                <Eyebrow>Passeio livre</Eyebrow>
                <h1>Arranha-Teia</h1>
                <p className="swing-lead">
                    {map.name} · {map.region}
                </p>
            </header>

            <div className="swing-layout">
                <Panel aria-label="Cidade" className="swing-stage-panel">
                    <div ref={stageRef} className="swing-stage" data-cue={game.cue}>
                        <canvas
                            ref={sceneRef}
                            className="swing-scene"
                            role="img"
                            aria-label={`Vista em primeira pessoa de ${map.name}`}
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
                            <div>
                                <dt>Teia</dt>
                                <dd data-testid="hud-web">
                                    {game.hud.gripped ? 'Agarrado' : webLabel(game.hud.webSides)}
                                </dd>
                            </div>
                        </dl>
                    </div>
                    <p className="swing-credit" data-testid="map-credit">
                        {game.attribution}
                    </p>
                    <DrawerToggle
                        open={debugDrawer.open}
                        panelId={debugDrawer.panelId}
                        onToggle={debugDrawer.toggle}
                    >
                        Depuração
                    </DrawerToggle>
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
                        <div className="swing-round-actions">
                            <Button variant="secondary" onClick={game.restart} disabled={game.phase !== 'playing'}>
                                Voltar ao início
                            </Button>
                            {onChangeMap ? (
                                <Button variant="text" onClick={onChangeMap}>
                                    Trocar mapa
                                </Button>
                            ) : null}
                        </div>
                    </Panel>
                    <CameraPanel
                        camera={camera}
                        videoRef={videoRef}
                        overlay={<HandOverlay canvasRef={overlayRef} />}
                    />
                    {camera.isActive && (
                        <Panel raised aria-label="Direção do olhar" className="swing-head">
                            <Eyebrow>Direção do olhar</Eyebrow>
                            <SegmentedControl
                                legend="Direção do olhar"
                                name="swing-look-mode"
                                value={game.lookMode}
                                options={LOOK_MODE_OPTIONS}
                                onChange={game.setLookMode}
                            />
                            {game.lookMode === 'face' ? (
                                <>
                                    <p aria-live="polite" className="round-status" data-testid="head-status">
                                        {headStatus || HEAD_IDLE_HINT}
                                    </p>
                                    <Button
                                        variant="secondary"
                                        onClick={game.recenterHead}
                                        disabled={game.faceTrackerStatus !== 'ready'}
                                    >
                                        Centralizar
                                    </Button>
                                </>
                            ) : (
                                <p className="round-status" data-testid="head-status">
                                    Câmera automática. As setas ajustam o olhar.
                                </p>
                            )}
                        </Panel>
                    )}
                    <Panel raised aria-label="Como jogar">
                        <Eyebrow>Como jogar</Eyebrow>
                        <Steps
                            label="Como jogar"
                            items={STEPS}
                            current={currentStep(game.cue)}
                        />
                        <p className="guide-hint" data-testid="guide-hint" aria-live="polite">
                            {hint}
                        </p>
                    </Panel>
                    <Panel raised aria-label="Teclado" className="swing-keys-panel">
                        <Eyebrow>Teclado</Eyebrow>
                        <ul className="swing-keys" data-testid="keyboard-legend">
                            {KEYS.map((group) => (
                                <li key={group.action}>
                                    {group.keys.map((key, index) => (
                                        <span key={key}>
                                            {index > 0 ? ' ' : ''}
                                            <kbd>{key}</kbd>
                                        </span>
                                    ))}{' '}
                                    {group.action}
                                </li>
                            ))}
                        </ul>
                    </Panel>
                    <PrivacyNotice />
                </div>
            </div>
            <DrawerPanel open={debugDrawer.open} panelId={debugDrawer.panelId}>
                <SwingDebugPanel hands={game.handDebug} head={game.headDebug} grab={game.grabDebug} />
            </DrawerPanel>
        </div>
    )
}
