import { chordById } from '@guess-my-move/guitar'
import { useRef } from 'react'

import { CameraPanel } from '../camera/CameraPanel.js'
import { type GetUserMedia } from '../camera/cameraService.js'
import { useCamera } from '../camera/useCamera.js'
import {
    Button,
    DrawerPanel,
    DrawerToggle,
    Eyebrow,
    Panel,
    SegmentedControl,
    Steps,
    useDrawer,
} from '../design/index.js'
import { HandOverlay } from '../round/HandOverlay.js'
import { PrivacyNotice } from '../shared/PrivacyNotice.js'
import { ChordDiagram } from './ChordDiagram.js'
import { GuitarDebugPanel } from './GuitarDebugPanel.js'
import { STEPS, currentStep, guideHint, statusLine } from './guide.js'
import { type GuitarDeps, useGuitarGame } from './useGuitarGame.js'

export interface GuitarScreenProps {
    /** `getUserMedia` injetável para teste (o navegador resolve por padrão). */
    cameraGetUserMedia?: GetUserMedia | null
    deps?: GuitarDeps
}

type Side = 'left' | 'right'

/** Texto do aviso de áudio, ou `null` quando o som está ligado ou ainda não precisa de aviso. */
function audioNotice(status: string): string | null {
    if (status === 'running') return null
    if (status === 'unavailable') return 'Este navegador não tem áudio. O jogo segue sem som.'
    return 'Som desligado. Clique na tela ou aperte uma tecla para ativar.'
}

/**
 * Tela do Violão no Ar: câmera ampla com braço projetado, reconhecimento automático do acorde,
 * status de uma linha, diagrama do resultado, guia e depuração. Todo o processamento é local;
 * nenhuma imagem sai do navegador.
 */
export function GuitarScreen({ cameraGetUserMedia, deps }: GuitarScreenProps) {
    const camera = useCamera(
        cameraGetUserMedia === undefined ? {} : { getUserMedia: cameraGetUserMedia },
    )
    const videoRef = useRef<HTMLVideoElement | null>(null)
    const overlayRef = useRef<HTMLCanvasElement | null>(null)
    const debugDrawer = useDrawer()
    const game = useGuitarGame({
        cameraActive: camera.isActive,
        videoRef,
        overlayRef,
        ...(deps === undefined ? {} : { deps }),
    })
    const { controller } = game

    const guide = {
        cameraActive: camera.isActive,
        trackerStatus: game.trackerStatus,
        trackerFailure: game.trackerFailure,
        fretVisible: game.fretVisible,
        strumVisible: game.strumVisible,
        leftHanded: game.leftHanded,
        detectedChord: game.detectedChord,
        completed: game.completed,
        audioStatus: game.audioStatus,
    }
    const notice = audioNotice(game.audioStatus)

    return (
        <div className="guitar-screen">
            <header className="guitar-header">
                <Eyebrow>Acordes básicos</Eyebrow>
                <h1>Violão no Ar</h1>
                <p className="guitar-lead">Forme o acorde com uma mão e bata com a outra.</p>
            </header>

            <div className="guitar-layout">
                <div className="guitar-main">
                    <div className="guitar-stage">
                        <CameraPanel
                            camera={camera}
                            videoRef={videoRef}
                            overlay={<HandOverlay canvasRef={overlayRef} />}
                        />
                    </div>
                    <Panel aria-label="Jogo" className="guitar-play">
                        <p aria-live="polite" className="round-status" data-testid="game-status">
                            {statusLine(guide)}
                        </p>
                        {game.trackerStatus === 'error' && (
                            <p className="round-error" role="alert">
                                Motivo: {game.trackerFailure}
                            </p>
                        )}
                        {notice && (
                            <p className="guitar-audio" role="status" data-testid="audio-notice">
                                {notice}
                            </p>
                        )}
                        <div className="guitar-strum-buttons">
                            <Button
                                onClick={() => {
                                    controller.strum('down')
                                }}
                            >
                                Bater para baixo
                            </Button>
                            <Button
                                variant="secondary"
                                onClick={() => {
                                    controller.strum('up')
                                }}
                            >
                                Bater para cima
                            </Button>
                        </div>
                        <DrawerToggle
                            open={debugDrawer.open}
                            panelId={debugDrawer.panelId}
                            onToggle={debugDrawer.toggle}
                        >
                            Depuração
                        </DrawerToggle>
                    </Panel>
                </div>

                <div className="guitar-side">
                    <Panel raised aria-label="Acorde reconhecido" className="guitar-detected">
                        <Eyebrow>Acorde reconhecido</Eyebrow>
                        {game.detectedChord ? (
                            <ChordDiagram chord={chordById(game.detectedChord)} />
                        ) : (
                            <p data-testid="detected-chord">Monte Em, Am, D, C ou G no braço.</p>
                        )}
                        <p className="guitar-supported">Reconhecimento pela posição dos dedos.</p>
                    </Panel>
                    <Panel raised aria-label="Como jogar">
                        <Eyebrow>Como jogar</Eyebrow>
                        <Steps label="Como jogar" items={STEPS} current={currentStep(guide)} />
                        <p className="guide-hint" data-testid="guide-hint" aria-live="polite">
                            {guideHint(guide)}
                        </p>
                    </Panel>
                    <Panel raised aria-label="Configuração">
                        <SegmentedControl<Side>
                            legend="Mão do braço"
                            name="guitar-side"
                            value={game.leftHanded ? 'right' : 'left'}
                            options={[
                                { value: 'left', label: 'Esquerda' },
                                { value: 'right', label: 'Direita' },
                            ]}
                            onChange={(side) => {
                                controller.setLeftHanded(side === 'right')
                            }}
                        />
                    </Panel>
                    <PrivacyNotice />
                </div>
            </div>

            <DrawerPanel open={debugDrawer.open} panelId={debugDrawer.panelId}>
                <GuitarDebugPanel snapshot={game} controller={controller} />
            </DrawerPanel>
        </div>
    )
}
