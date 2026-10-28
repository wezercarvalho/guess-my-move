import { DEFAULT_PHYSICS } from '@guess-my-move/marbles'
import { useEffect, useRef } from 'react'

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
    useDrawer,
} from '../design/index.js'
import { HandOverlay } from '../round/HandOverlay.js'
import { PrivacyNotice } from '../shared/PrivacyNotice.js'
import { drawField } from './fieldView.js'
import { MarblesDebugPanel } from './MarblesDebugPanel.js'
import { type MarblesMode } from './marblesController.js'
import { ShotGuide } from './ShotGuide.js'
import { type MarblesDeps, useMarblesGame } from './useMarblesGame.js'

export interface MarblesScreenProps {
    /** `getUserMedia` injetável para teste (o navegador resolve por padrão). */
    cameraGetUserMedia?: GetUserMedia | null
    deps?: MarblesDeps
}

type Round = ReturnType<typeof useMarblesGame>['round']
type TrackerStatus = ReturnType<typeof useMarblesGame>['trackerStatus']

const SHOT_MODES = [
    { value: 'pinch', label: 'Pinça' },
    { value: 'flick', label: 'Estalo (alpha)' },
] as const satisfies readonly { value: MarblesMode; label: string }[]

/** Uma linha de status: o que fazer agora. Os detalhes ficam no guia ("Como jogar"). */
function statusText(
    round: Round,
    tracker: TrackerStatus,
    handVisible: boolean,
    mode: MarblesMode,
): string {
    switch (round.state) {
        case 'idle':
            return tracker === 'loading' ? 'Carregando o detector…' : 'Ative a câmera para jogar.'
        case 'ready':
            if (!handVisible) return 'Mostre a mão inteira para a câmera.'
            return mode === 'flick' ? 'Mão à vista. Feche a mão.' : 'Mão à vista. Feche a pinça.'
        case 'aiming':
            if (mode === 'flick') return 'Armado. Mire e estique o polegar.'
            return round.aim?.shot ? 'Mira pronta. Abra os dedos.' : 'Mirando: afaste mais a mão.'
        case 'rolling':
            return 'Bolinha rolando…'
        case 'hit': {
            const shots = round.hitShots ?? round.shots
            return `Acertou em ${shots} ${shots === 1 ? 'tiro' : 'tiros'}!`
        }
        case 'camera_denied':
            return 'Sem câmera não há jogo. Libere o acesso no navegador.'
        case 'tracker_error':
            return 'O detector falhou. Use “Nova rodada”.'
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
    const debugDrawer = useDrawer()
    const canRestart = round.state !== 'idle' && round.state !== 'camera_denied'

    return (
        <div className="marbles-screen">
            <header className="marbles-header">
                <Eyebrow>Bete solo</Eyebrow>
                <h1>Bolinhas de gude</h1>
                <p className="marbles-lead">
                    Acerte o alvo vermelho com a bolinha azul, no menor número de tiros.
                </p>
            </header>

            <div className="marbles-layout">
                <Panel aria-labelledby="field-heading" className="marbles-field-panel">
                    <div className="marbles-toolbar">
                        <h2 id="field-heading">Campo</h2>
                        <SegmentedControl
                            legend="Modo de tiro"
                            name="shot-mode"
                            value={game.mode}
                            options={SHOT_MODES}
                            onChange={game.setMode}
                        />
                        <DrawerToggle
                            open={debugDrawer.open}
                            panelId={debugDrawer.panelId}
                            onToggle={debugDrawer.toggle}
                        >
                            Depuração
                        </DrawerToggle>
                    </div>
                    <canvas
                        ref={fieldRef}
                        className="marbles-field"
                        width={DEFAULT_PHYSICS.width}
                        height={DEFAULT_PHYSICS.height}
                        role="img"
                        aria-label="Campo do jogo, visto de cima"
                    />
                </Panel>

                <div className="marbles-side">
                    <Panel raised aria-label="Rodada" className="marbles-round">
                        <p className="shot-counter" data-testid="shot-counter">
                            Tiros: {round.shots}
                        </p>
                        <p aria-live="polite" className="round-status" data-testid="game-status">
                            {statusText(round, game.trackerStatus, game.debug.handVisible, game.mode)}
                        </p>
                        {round.state === 'tracker_error' && (
                            <p className="round-error" role="alert">
                                Motivo: {round.failureReason}
                            </p>
                        )}
                        <Button variant="secondary" onClick={game.newRound} disabled={!canRestart}>
                            Nova rodada
                        </Button>
                    </Panel>
                    <CameraPanel
                        camera={camera}
                        videoRef={videoRef}
                        overlay={<HandOverlay canvasRef={overlayRef} />}
                    />
                    <Panel raised aria-label="Como jogar">
                        <Eyebrow>Como jogar</Eyebrow>
                        <ShotGuide
                            mode={game.mode}
                            state={round.state}
                            phase={game.debug.flick.phase}
                            shotReady={round.aim?.shot != null}
                            handVisible={game.debug.handVisible}
                            lastResult={game.debug.flick.lastResult}
                        />
                    </Panel>
                    <PrivacyNotice />
                </div>
            </div>

            <DrawerPanel open={debugDrawer.open} panelId={debugDrawer.panelId}>
                <MarblesDebugPanel debug={game.debug} state={round.state} mode={game.mode} />
            </DrawerPanel>
        </div>
    )
}
