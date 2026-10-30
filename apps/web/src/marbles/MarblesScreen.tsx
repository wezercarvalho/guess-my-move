import { type BotLevel, DEFAULT_PHYSICS, modes, type Opponent, type Outcome } from '@guess-my-move/marbles'
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
import { type MatchView, type ShotControl } from './marblesController.js'
import { ShotGuide } from './ShotGuide.js'
import { type MarblesDeps, type MarblesGameView, useMarblesGame } from './useMarblesGame.js'

export interface MarblesScreenProps {
    /** `getUserMedia` injetável para teste (o navegador resolve por padrão). */
    cameraGetUserMedia?: GetUserMedia | null
    deps?: MarblesDeps
}

const SHOT_CONTROLS = [
    { value: 'pinch', label: 'Pinça' },
    { value: 'flick', label: 'Estalo (alpha)' },
] as const satisfies readonly { value: ShotControl; label: string }[]

const OPPONENTS = [
    { value: 'target', label: 'Contra a meta' },
    { value: 'bot', label: 'Contra o bot' },
] as const satisfies readonly { value: Opponent; label: string }[]

const BOT_LEVEL_OPTIONS = [
    { value: 'easy', label: 'Fácil' },
    { value: 'medium', label: 'Médio' },
    { value: 'hard', label: 'Difícil' },
] as const satisfies readonly { value: BotLevel; label: string }[]

const BOT_LEVEL_LABEL: Record<BotLevel, string> = {
    easy: 'Fácil',
    medium: 'Médio',
    hard: 'Difícil',
}

const OUTCOME_LABEL: Record<Outcome, string> = {
    win: 'Vitória',
    loss: 'Derrota',
    draw: 'Empate',
}

const ROUND_LABEL: Record<Outcome, string> = {
    win: 'Venceu',
    loss: 'Perdeu',
    draw: 'Empatou',
}

/**
 * Uma linha de status: o que fazer agora. Cobre sem câmera, detector carregando,
 * mão não vista, sua vez, vez do bot, rodada vencida/empatada/perdida, partida
 * encerrada e falha do detector. Os detalhes ficam no guia "Como jogar".
 */
function statusText(game: MarblesGameView): string {
    if (game.failureReason) return 'O detector falhou. Use “Trocar de modo”.'
    if (game.cameraFailed) return 'Sem câmera não há jogo. Libere o acesso no navegador.'
    const match = game.match
    if (!match) {
        return game.trackerStatus === 'loading'
            ? 'Carregando o detector…'
            : 'Escolha o modo e o adversário e comece.'
    }
    switch (match.phase) {
        case 'player-turn':
            if (game.trackerStatus !== 'ready') return 'Ative a câmera para jogar.'
            if (!game.debug.handVisible) return 'Mostre a mão inteira para a câmera.'
            if (game.aim) {
                if (game.shotControl === 'flick') return 'Armado. Mire e estique o polegar.'
                return game.aim.shot ? 'Mira pronta. Abra os dedos.' : 'Mirando: afaste mais a mão.'
            }
            return game.shotControl === 'flick' ? 'Sua vez. Feche a mão.' : 'Sua vez. Feche a pinça.'
        case 'bot-turn':
            return 'Vez do bot…'
        case 'rolling':
            return 'Bolinha rolando…'
        case 'round-over':
            return match.lastRoundOutcome
                ? `Rodada: ${ROUND_LABEL[match.lastRoundOutcome]}. Próxima rodada…`
                : 'Fim da rodada.'
        case 'match-over':
            return match.matchOutcome
                ? `Partida encerrada: ${OUTCOME_LABEL[match.matchOutcome]}.`
                : 'Partida encerrada.'
        default:
            return ''
    }
}

/** Placar das rodadas: um marcador por rodada já encerrada. */
function Scoreboard({ match }: { match: MatchView }) {
    return (
        <ol className="marbles-scoreboard" aria-label="Placar das rodadas">
            {Array.from({ length: match.roundsPerMatch }, (_unused, index) => {
                const outcome = match.roundOutcomes[index]
                const label = outcome ? ROUND_LABEL[outcome] : `Rodada ${index + 1}`
                return (
                    <li
                        key={index}
                        className={`marbles-score marbles-score--${outcome ?? 'pending'}`}
                        data-testid={`round-${index + 1}`}
                    >
                        {label}
                    </li>
                )
            })}
        </ol>
    )
}

/**
 * Tela da partida das bolinhas: tela inicial de escolha (modo, adversário,
 * controle de tiro), e durante a partida o campo do modo, a câmera, o placar, a
 * vez, os tiros restantes e o guia. Todo o processamento é local; nenhuma imagem
 * sai do navegador.
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
        if (!fieldRef.current || !game.match) return
        drawField(fieldRef.current, {
            field: game.match.field,
            decor: game.match.decor,
            aim: game.aim,
            hand: game.hand,
            shooterOwner: game.match.turn ?? 'player',
        })
    }, [game.match, game.aim, game.hand])

    const debugDrawer = useDrawer()
    const selectedMode = modes.find((m) => m.id === game.modeId) ?? modes[0]
    const matchMode = game.match ? (modes.find((m) => m.id === game.match?.modeId) ?? modes[0]) : null
    const guideMode = (matchMode ?? selectedMode).create()
    const ready = game.match?.phase === 'player-turn' && game.trackerStatus === 'ready'

    return (
        <div className="marbles-screen">
            <header className="marbles-header">
                <Eyebrow>Bolinhas de gude</Eyebrow>
                <h1>Bolinhas de gude</h1>
                <p className="marbles-lead">
                    Escolha o modo e o adversário, mire com a mão e jogue as três rodadas.
                </p>
            </header>

            <div className="marbles-layout">
                <Panel aria-labelledby="field-heading" className="marbles-field-panel">
                    <div className="marbles-toolbar">
                        <h2 id="field-heading">Campo</h2>
                        <SegmentedControl
                            legend="Controle de tiro"
                            name="shot-control"
                            value={game.shotControl}
                            options={SHOT_CONTROLS}
                            onChange={game.setShotControl}
                        />
                        <DrawerToggle
                            open={debugDrawer.open}
                            panelId={debugDrawer.panelId}
                            onToggle={debugDrawer.toggle}
                        >
                            Depuração
                        </DrawerToggle>
                    </div>

                    {game.choosing ? (
                        <div className="marbles-setup" data-testid="setup">
                            <SegmentedControl
                                legend="Modo"
                                name="mode"
                                value={game.modeId}
                                options={modes.map((m) => ({ value: m.id, label: m.name }))}
                                onChange={game.setMode}
                            />
                            <SegmentedControl
                                legend="Adversário"
                                name="opponent"
                                value={game.opponent}
                                options={OPPONENTS}
                                onChange={game.setOpponent}
                            />
                            {game.opponent === 'bot' && (
                                <SegmentedControl
                                    legend="Nível do bot"
                                    name="bot-level"
                                    value={game.botLevel}
                                    options={BOT_LEVEL_OPTIONS}
                                    onChange={game.setBotLevel}
                                />
                            )}
                            <Button onClick={game.startMatch}>Começar partida</Button>
                        </div>
                    ) : (
                        <canvas
                            ref={fieldRef}
                            className="marbles-field"
                            width={DEFAULT_PHYSICS.width}
                            height={DEFAULT_PHYSICS.height}
                            role="img"
                            aria-label="Campo do jogo, visto de cima"
                        />
                    )}
                </Panel>

                <div className="marbles-side">
                    <Panel raised aria-label="Rodada" className="marbles-round">
                        {game.match ? (
                            <>
                                <p className="match-mode" data-testid="match-mode">
                                    {matchMode?.name} ·{' '}
                                    {game.match.opponent === 'bot'
                                        ? `Contra o bot · ${BOT_LEVEL_LABEL[game.botLevel]}`
                                        : 'Contra a meta'}
                                </p>
                                <p className="round-number" data-testid="round-number">
                                    Rodada {game.match.round + 1} de {game.match.roundsPerMatch}
                                </p>
                                <Scoreboard match={game.match} />
                                {game.match.scoreLabel && (
                                    <p className="round-yield" data-testid="round-yield">
                                        {game.match.scoreLabel}:{' '}
                                        {game.match.opponent === 'bot'
                                            ? `Você ${game.match.roundYield.player} × ${game.match.roundYield.opponent} Bot`
                                            : game.match.roundYield.player}
                                    </p>
                                )}
                                <p className="shot-counter" data-testid="shots-left">
                                    Tiros restantes: {game.match.playerShotsLeft}
                                </p>
                                <p className="turn-indicator" data-testid="turn">
                                    {game.match.opponent === 'bot'
                                        ? game.match.turn === 'player'
                                            ? 'Sua vez'
                                            : game.match.turn === 'opponent'
                                              ? 'Vez do bot'
                                              : '—'
                                        : 'Contra a meta'}
                                </p>
                                {game.match.opponent === 'bot' && (
                                    <p className="marbles-legend" data-testid="legend">
                                        <span className="swatch swatch--player" aria-hidden="true" />{' '}
                                        Você
                                        <span className="swatch swatch--bot" aria-hidden="true" /> Bot
                                    </p>
                                )}
                            </>
                        ) : (
                            <p className="round-number" data-testid="round-number">
                                {selectedMode.name} ·{' '}
                                {game.opponent === 'bot'
                                    ? `Contra o bot · ${BOT_LEVEL_LABEL[game.botLevel]}`
                                    : 'Contra a meta'}
                            </p>
                        )}
                        <p aria-live="polite" className="round-status" data-testid="game-status">
                            {statusText(game)}
                        </p>
                        {game.failureReason && (
                            <p className="round-error" role="alert">
                                Motivo: {game.failureReason}
                            </p>
                        )}
                        {game.match?.phase === 'match-over' && (
                            <div className="marbles-endgame" data-testid="endgame">
                                <p className="endgame-result">
                                    {game.match.matchOutcome
                                        ? OUTCOME_LABEL[game.match.matchOutcome]
                                        : ''}
                                </p>
                                <Button onClick={game.playAgain}>Jogar de novo</Button>
                                <Button variant="secondary" onClick={game.changeMode}>
                                    Trocar de modo
                                </Button>
                            </div>
                        )}
                        {game.match && game.match.phase !== 'match-over' && (
                            <Button variant="secondary" onClick={game.changeMode}>
                                Trocar de modo
                            </Button>
                        )}
                    </Panel>
                    <CameraPanel
                        camera={camera}
                        videoRef={videoRef}
                        overlay={<HandOverlay canvasRef={overlayRef} />}
                    />
                    <Panel raised aria-label="Como jogar">
                        <Eyebrow>Como jogar</Eyebrow>
                        <ShotGuide
                            mode={guideMode}
                            modeId={game.match?.modeId ?? game.modeId}
                            opponent={game.match?.opponent ?? game.opponent}
                            shotControl={game.shotControl}
                            ready={ready}
                            aiming={game.aim !== null}
                            flickPhase={game.debug.flick.phase}
                            shotReady={game.aim?.shot != null}
                            handVisible={game.debug.handVisible}
                            lastResult={game.debug.flick.lastResult}
                        />
                    </Panel>
                    <PrivacyNotice />
                </div>
            </div>

            <DrawerPanel open={debugDrawer.open} panelId={debugDrawer.panelId}>
                <MarblesDebugPanel debug={game.debug} shotControl={game.shotControl} />
            </DrawerPanel>
        </div>
    )
}
