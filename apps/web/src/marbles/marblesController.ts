import { AsyncTrackerResource } from '../capture/asyncTrackerResource.js'
import { VideoFrameGate } from '../capture/videoFrameGate.js'
import { MarblesHandInput } from './handInput.js'
import type {
    MarblesEnv,
    MarblesSurfaces,
    MarblesSnapshot,
    PlayType,
    ShotControl,
    OpponentIntent,
    MatchView,
} from './marblesTypes.js'
export type {
    MarblesTrackerStatus,
    ShotControl,
    PlayType,
    FlickOutcome,
    MarblesEnv,
    MarblesSurfaces,
    MarblesDebug,
    AimView,
    OpponentIntent,
    MatchView,
    MarblesSnapshot,
} from './marblesTypes.js'
import {
    type Body,
    BOT_LEVELS,
    type BotLevel,
    type BotPlanner,
    DEFAULT_BOT_LEVEL,
    type Competitor,
    type Mode,
    type ModeEntry,
    type MatchSession,
    type ModeId,
    type Opponent,
    type Outcome,
    type ShotSource,
    type Vec,
    DEFAULT_PHYSICS,
    createBotPlanner,
    createMatchSession,
    modes,
} from '@guess-my-move/marbles'

import { drawHand } from '../round/handOverlay.js'
import { summarizeLatency } from '../round/latency.js'
import { type HandTracker } from '../tracker/handTracker.js'
import { type MultiplayerSnapshot } from './multiplayerClient.js'

/** Lê `?mode=estalo` da URL; qualquer outro valor mantém a pinça. */
export function shotControlFromSearch(search: string): ShotControl {
    return new URLSearchParams(search).get('mode')?.toLowerCase() === 'estalo'
        ? 'flick'
        : 'pinch'
}

function outcomeForRole(
    outcome: Outcome | null,
    role: Competitor | null,
): Outcome | null {
    if (!outcome || role !== 'opponent') return outcome
    if (outcome === 'win') return 'loss'
    if (outcome === 'loss') return 'win'
    return 'draw'
}

const LATENCY_WINDOW = 300
const PUBLISH_INTERVAL_MS = 100
const SUMMARY_INTERVAL_MS = 250
const CAMERA_FPS_WINDOW_MS = 1000
/** Espera curta (ms) mostrando o resultado da rodada antes de começar a próxima. */
const ROUND_DWELL_MS = 900
/** Tempo inicial para a pessoa ver a intenção do adversário antes do tiro. */
const OPPONENT_INTENT_MS = 450

const messageOf = (error: unknown) =>
    error instanceof Error && error.message
        ? error.message
        : 'Falha ao usar o detector de mão.'

function modeEntry(modeId: string): ModeEntry {
    return modes.find((m) => m.id === modeId) ?? modes[0]
}

/** Fonte determinística do bot; ausência de campo/alvo significa passar a vez. */
export function createBotShotSource(
    entry: Pick<ModeEntry, 'botAimPoint'>,
    mode: Mode,
    planner: BotPlanner,
    seedBase: number,
): ShotSource {
    const aimPoint = entry.botAimPoint(mode)
    let shot = 0
    return {
        nextShot(field?: readonly Body[]): Vec | null {
            if (!field || field.length === 0) return null
            const point = aimPoint(field, 'opponent')
            if (!point) return null
            shot++
            return planner.planShot(field[0].pos, point, seedBase + shot * 101)
        },
    }
}
/**
 * Orquestra câmera, detector de mão, controlador de mira e a partida animada,
 * sem depender do React: a interface assina as mudanças (`subscribe`/
 * `getSnapshot`). O laço por quadro lê um quadro novo do vídeo, mede a pinça,
 * alimenta a mira na vez do jogador e avança a física; na vez do bot, o gesto é
 * ignorado e o tiro do bot é animado. Nada é gravado nem enviado.
 */
export class MarblesController {
    private readonly env: MarblesEnv
    private readonly listeners = new Set<() => void>()
    private readonly handInput = new MarblesHandInput()
    private get reading() {
        return this.handInput.reading
    }
    private get flickReading() {
        return this.handInput.flickReading
    }
    private get aimView() {
        return this.handInput.aimView
    }
    private get lastFlick() {
        return this.handInput.lastFlick
    }
    // Escolha da tela inicial.
    private modeId: ModeId
    private opponent: Opponent = 'target'
    private botLevel: BotLevel = DEFAULT_BOT_LEVEL
    private shotControl: ShotControl
    private playType: PlayType = 'local'
    private multiplayer: MultiplayerSnapshot = {
        connection: 'idle',
        access: null,
        room: null,
        error: null,
    }
    private sendRemoteShot: ((velocity: Vec) => void) | null = null

    // Partida em andamento.
    private session: MatchSession | null = null
    private botSource: ShotSource | null = null
    private opponentIntent: OpponentIntent | null = null
    private opponentIntentDue: number | null = null
    private roundDwellUntil: number | null = null

    private readonly detector = new AsyncTrackerResource<HandTracker>(messageOf)
    private get tracker() {
        return this.detector.value
    }
    private get trackerStatus() {
        return this.detector.status
    }
    private get failureReason() {
        return this.detector.error
    }
    private get delegate() {
        return this.tracker?.delegate ?? null
    }
    private cameraActive = false
    private cameraFailed = false
    private attached = false
    private surfaces: MarblesSurfaces = {
        getVideo: () => null,
        getOverlay: () => null,
    }
    private loop: number | null = null
    private readonly cameraFrames = new VideoFrameGate((now) =>
        this.countCameraFrame(now ?? this.env.now()),
    )
    private cameraFps: number | null = null
    private cameraWindowStart: number | null = null
    private cameraWindowCount = 0
    private lastNow: number | null = null
    private frames = 0
    private latencies: number[] = []
    private summary = summarizeLatency([])
    private lastSummaryAt = 0
    private lastEmitAt = 0
    private snapshot: MarblesSnapshot

    constructor(env: MarblesEnv, shotControl: ShotControl = 'pinch') {
        this.env = env
        this.shotControl = shotControl
        this.modeId = modes[0].id
        this.snapshot = this.buildSnapshot()
    }

    readonly subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener)
        return () => {
            this.listeners.delete(listener)
        }
    }

    readonly getSnapshot = (): MarblesSnapshot => this.snapshot

    attach(surfaces: MarblesSurfaces): void {
        this.surfaces = surfaces
        this.attached = true
        this.sync()
    }

    detach(): void {
        this.attached = false
        this.stopLoop()
        this.detector.release()
        this.handInput.clearReadings()
        this.snapshot = this.buildSnapshot()
    }

    readonly setPlayType = (playType: PlayType): void => {
        if (this.session || this.multiplayer.room) return
        this.playType = playType
        if (playType === 'online') this.opponent = 'remote'
        else if (this.opponent === 'remote') this.opponent = 'target'
        this.sync()
    }

    setMultiplayer(
        snapshot: MultiplayerSnapshot,
        sendShot: ((velocity: Vec) => void) | null,
    ): void {
        const previous = this.multiplayer
        if (
            previous.room?.matchNumber !== snapshot.room?.matchNumber ||
            previous.room?.match?.turn !== snapshot.room?.match?.turn ||
            previous.room?.status !== snapshot.room?.status ||
            previous.connection !== snapshot.connection ||
            snapshot.room?.intent
        ) {
            this.handInput.resetForTurn()
        }
        this.multiplayer = snapshot
        this.sendRemoteShot = sendShot
        if (snapshot.access && !this.session) {
            this.playType = 'online'
            this.opponent = 'remote'
        }
        if (snapshot.room) {
            this.playType = 'online'
            this.modeId = snapshot.room.modeId
            this.opponent = 'remote'
        }
        this.sync()
    }

    setCamera(active: boolean, failed: boolean): void {
        this.cameraActive = active
        this.cameraFailed = failed
        this.sync()
    }

    /** Escolhe o modo na tela inicial (sem efeito durante a partida). */
    readonly setMode = (modeId: string): void => {
        if (this.session || this.multiplayer.room) return
        const entry = modes.find((mode) => mode.id === modeId)
        if (!entry) return
        this.modeId = entry.id
        this.sync()
    }

    /** Escolhe o adversário na tela inicial (sem efeito durante a partida). */
    readonly setOpponent = (opponent: Opponent): void => {
        if (this.playType !== 'local' || this.session || this.multiplayer.room)
            return
        if (opponent === 'remote') return
        this.opponent = opponent
        this.sync()
    }

    /** Escolhe o nível do bot na tela inicial (sem efeito durante a partida). */
    readonly setBotLevel = (level: BotLevel): void => {
        if (this.session || this.multiplayer.room) return
        this.botLevel = level
        this.sync()
    }

    /** Troca o controle de tiro (pinça/estalo); zera a mira em andamento. */
    readonly setShotControl = (control: ShotControl): void => {
        if (control === this.shotControl) return
        this.shotControl = control
        this.handInput.resetForSession()
        this.sync()
    }

    /** Começa a partida com o modo e o adversário escolhidos. */
    readonly startMatch = (): void => {
        if (this.playType !== 'local') return
        const entry = modeEntry(this.modeId)
        const mode: Mode = entry.create()
        this.botSource =
            this.opponent === 'bot' ? this.makeBotSource(entry, mode) : null
        this.session = createMatchSession({
            modeId: entry.id,
            mode,
            opponent: this.opponent,
        })
        this.handInput.resetForSession()
        this.opponentIntent = null
        this.opponentIntentDue = null
        this.roundDwellUntil = null
        this.sync()
    }

    /** Joga de novo com o mesmo modo e adversário. */
    readonly playAgain = (): void => {
        this.startMatch()
    }

    /** Volta à tela de escolha (trocar de modo). */
    readonly changeMode = (): void => {
        this.session = null
        this.botSource = null
        this.opponentIntent = null
        this.opponentIntentDue = null
        this.roundDwellUntil = null
        this.handInput.resetForSession()
        this.sync()
    }

    /**
     * Fonte do tiro do bot: mira o ponto do modo e planeja com a semente da
     * partida. Sem semente injetada (produção), cada partida sorteia a sua, para
     * a sequência de acertos e erros do bot não se repetir de uma partida à outra.
     */
    private makeBotSource(entry: ModeEntry, mode: Mode): ShotSource {
        const planner = (
            this.env.createBot ??
            ((level) => createBotPlanner(BOT_LEVELS[level]))
        )(this.botLevel)
        const seedBase =
            this.env.seed ?? Math.floor(Math.random() * 0x1_0000_0000)
        return createBotShotSource(entry, mode, planner, seedBase)
    }

    private sync(): void {
        this.reconcile()
        if (this.attached && this.cameraActive && this.trackerStatus === 'idle')
            this.loadTracker()
        this.ensureLoop()
        this.emit()
    }

    private reconcile(): void {
        if (!this.cameraActive && !this.cameraFailed) {
            // Câmera desligada: o detector é liberado; a partida escolhida é preservada.
            if (this.trackerStatus !== 'idle') {
                this.releaseTracker()
            }
        }
    }

    private releaseTracker(): void {
        this.stopLoop()
        this.detector.release()
        this.handInput.clearReadings()
    }
    private loadTracker(): void {
        if (this.cameraFailed) return
        this.detector.load(() => this.env.createTracker(), {
            alive: () =>
                this.attached && this.cameraActive && !this.cameraFailed,
            onReady: () => this.sync(),
            onError: () => this.sync(),
        })
    }

    private ensureLoop(): void {
        if (
            this.loop !== null ||
            !this.attached ||
            !this.cameraActive ||
            !this.tracker ||
            this.trackerStatus !== 'ready'
        )
            return
        this.lastNow = null
        this.cameraFps = null
        this.cameraWindowStart = null
        this.cameraWindowCount = 0
        this.watchCameraFrames()
        this.loop = this.env.requestFrame(this.step)
    }

    private readonly step = (): void => {
        this.loop = null
        const tracker = this.tracker
        const video = this.surfaces.getVideo()
        if (!tracker || !video || !this.cameraActive) return
        const { env } = this
        const now = env.now()
        const dt = this.lastNow === null ? 0 : now - this.lastNow
        this.lastNow = now
        let processedFrame = false

        if (
            video.readyState >= 2 &&
            video.videoWidth > 0 &&
            this.takeNewCameraFrame(video, now)
        ) {
            processedFrame = true
            try {
                const hand = tracker.detect(video, now)
                this.latencies.push(env.now() - now)
                if (this.latencies.length > LATENCY_WINDOW)
                    this.latencies.shift()
                this.frames++
                const aspect = video.videoWidth / video.videoHeight
                this.readHand(hand, aspect, now)
                const canvas = this.surfaces.getOverlay()
                if (canvas) drawHand(canvas, video, hand?.landmarks ?? null)
            } catch (error) {
                this.releaseTracker()
                this.detector.fail(error)
                this.clearOverlay()
                this.emit()
                return
            }
        }

        this.advanceMatch(dt, now)

        if (
            processedFrame ||
            this.session?.snapshot().phase === 'rolling' ||
            this.aimView !== null ||
            now - this.lastEmitAt >= PUBLISH_INTERVAL_MS
        ) {
            this.emit()
        }
        this.loop = env.requestFrame(this.step)
    }

    private currentShooter(): Vec | null {
        if (this.playType === 'online') {
            const room = this.multiplayer.room
            const role = this.multiplayer.access?.role
            if (
                !room?.match ||
                !role ||
                room.status !== 'playing' ||
                room.intent ||
                this.multiplayer.connection !== 'connected'
            )
                return null
            const phase = role === 'player' ? 'player-turn' : 'opponent-turn'
            if (room.match.turn !== role || room.match.phase !== phase)
                return null
            const shooter = room.match.field[0]
            return shooter ? { ...shooter.pos } : null
        }
        return this.session?.shooter() ?? null
    }

    private awaitingOwnShot(): boolean {
        if (this.playType === 'online') return this.currentShooter() !== null
        return this.session?.awaitingPlayerShot() ?? false
    }

    private fireCurrentShot(velocity: Vec): void {
        if (this.playType === 'online') {
            this.sendRemoteShot?.(velocity)
            return
        }
        this.session?.firePlayerShot(velocity)
    }

    /** Lê a mão no quadro e, na própria vez, alimenta o controlador de mira. */
    private readHand(
        hand: ReturnType<HandTracker['detect']>,
        aspect: number,
        now: number,
    ): void {
        const shot = this.handInput.update(
            hand,
            aspect,
            now,
            this.currentShooter(),
            this.awaitingOwnShot(),
            this.shotControl,
        )
        if (shot) this.fireCurrentShot(shot)
    }

    /** Avança a partida: mostra a intenção do bot, anima a rolagem e troca a rodada. */
    private advanceMatch(dt: number, now: number): void {
        if (this.playType === 'online') return
        const session = this.session
        if (!session) return
        const snap = session.snapshot()
        if (snap.phase === 'round-over') {
            this.clearOpponentIntent()
            if (this.roundDwellUntil === null)
                this.roundDwellUntil = now + ROUND_DWELL_MS
            else if (now >= this.roundDwellUntil) {
                this.roundDwellUntil = null
                session.beginNextRound()
                this.handInput.resetAim()
            }
            return
        }
        this.roundDwellUntil = null

        if (snap.phase === 'opponent-turn' && snap.opponent === 'bot') {
            if (!this.opponentIntent) {
                session.shooter()
                const velocity =
                    this.botSource?.nextShot(session.snapshot().field) ?? null
                if (!velocity) {
                    session.passShot('opponent')
                    return
                }
                this.opponentIntent = {
                    velocity,
                    power: Math.min(
                        1,
                        Math.hypot(velocity.x, velocity.y) / 1100,
                    ),
                }
                this.opponentIntentDue = now + OPPONENT_INTENT_MS
                return
            }
            if (
                this.opponentIntentDue !== null &&
                now >= this.opponentIntentDue
            ) {
                session.fireShot('opponent', this.opponentIntent.velocity)
                this.clearOpponentIntent()
            }
            return
        }

        this.clearOpponentIntent()
        session.advance(dt)
    }

    private clearOpponentIntent(): void {
        this.opponentIntent = null
        this.opponentIntentDue = null
    }

    private stopLoop(): void {
        if (this.loop !== null) this.env.cancelFrame(this.loop)
        this.loop = null
        this.unwatchCameraFrames()
    }

    private watchCameraFrames(): void {
        this.cameraFrames.watch(this.surfaces.getVideo())
    }
    private unwatchCameraFrames(): void {
        this.cameraFrames.unwatch()
    }
    private takeNewCameraFrame(video: HTMLVideoElement, now: number): boolean {
        return this.cameraFrames.take(video, now)
    }

    private countCameraFrame(now: number): void {
        if (this.cameraWindowStart === null) {
            this.cameraWindowStart = now
            this.cameraWindowCount = 1
            return
        }
        this.cameraWindowCount++
        const elapsed = now - this.cameraWindowStart
        if (elapsed >= CAMERA_FPS_WINDOW_MS) {
            this.cameraFps = ((this.cameraWindowCount - 1) * 1000) / elapsed
            this.cameraWindowStart = now
            this.cameraWindowCount = 1
        }
    }

    private clearOverlay(): void {
        const canvas = this.surfaces.getOverlay()
        const video = this.surfaces.getVideo()
        if (canvas && video) drawHand(canvas, video, null)
    }

    private handOnField(): MarblesSnapshot['hand'] {
        const reading = this.reading
        if (!reading?.handVisible || !reading.point) return null
        return {
            point: {
                x: reading.point.x * DEFAULT_PHYSICS.width,
                y: reading.point.y * DEFAULT_PHYSICS.height,
            },
            closed: reading.closed,
        }
    }

    private matchView(): MatchView | null {
        const remote =
            this.playType === 'online' ? this.multiplayer.room?.match : null
        const snap =
            this.playType === 'online' ? remote : this.session?.snapshot()
        if (!snap) return null
        const role = remote ? (this.multiplayer.access?.role ?? null) : null
        return {
            modeId: snap.modeId,
            opponent: snap.opponent,
            phase: snap.phase,
            round: snap.round,
            roundsPerMatch: snap.roundsPerMatch,
            roundOutcomes: snap.roundOutcomes.map(
                (outcome) => outcomeForRole(outcome, role) ?? outcome,
            ),
            lastRoundOutcome: outcomeForRole(snap.lastRoundOutcome, role),
            matchOutcome: outcomeForRole(snap.matchOutcome, role),
            turn: snap.turn,
            shotsLeft: { ...snap.shotsLeft },
            roundYield: { ...snap.roundYield },
            scoreLabel: snap.scoreLabel,
            field: snap.field.map((body) => ({
                pos: { ...body.pos },
                vel: { ...body.vel },
                radius: body.radius,
            })),
            decor: snap.decor,
        }
    }

    private buildSnapshot(): MarblesSnapshot {
        const now = this.env.now()
        if (
            now - this.lastSummaryAt >= SUMMARY_INTERVAL_MS ||
            (this.summary.medianMs === null && this.latencies.length > 0)
        ) {
            this.summary = summarizeLatency(this.latencies)
            this.lastSummaryAt = now
        }
        const remoteRoom =
            this.playType === 'online' ? this.multiplayer.room : null
        const remoteRole = this.multiplayer.access?.role ?? null
        const localOwnTurn = this.session?.snapshot().phase === 'player-turn'
        const remoteOwnTurn =
            this.multiplayer.connection === 'connected' &&
            !remoteRoom?.intent &&
            remoteRoom?.status === 'playing' &&
            remoteRoom.match?.turn === remoteRole &&
            remoteRoom.match.phase ===
                (remoteRole === 'opponent' ? 'opponent-turn' : 'player-turn')
        const ownTurn =
            this.playType === 'online' ? remoteOwnTurn : localOwnTurn
        const remoteIntent = remoteRoom?.intent
            ? {
                  velocity: { ...remoteRoom.intent.velocity },
                  power: Math.min(
                      1,
                      Math.hypot(
                          remoteRoom.intent.velocity.x,
                          remoteRoom.intent.velocity.y,
                      ) / 1100,
                  ),
              }
            : null
        return {
            playType: this.playType,
            multiplayer: this.multiplayer,
            choosing:
                this.playType === 'online'
                    ? this.multiplayer.room === null
                    : this.session === null,
            modeId: remoteRoom?.modeId ?? this.modeId,
            opponent: this.playType === 'online' ? 'remote' : this.opponent,
            botLevel: this.botLevel,
            shotControl: this.shotControl,
            trackerStatus: this.trackerStatus,
            cameraFailed: this.cameraFailed,
            failureReason: this.failureReason,
            match: this.matchView(),
            aim: ownTurn ? this.aimView : null,
            opponentIntent:
                this.playType === 'online'
                    ? remoteIntent
                    : this.opponentIntent
                      ? { ...this.opponentIntent }
                      : null,
            hand: this.handOnField(),
            debug: {
                delegate: this.delegate,
                ratio: this.reading?.ratio ?? null,
                pinchClosed: this.reading?.closed ?? false,
                handVisible: this.reading?.handVisible ?? false,
                flick: {
                    armed:
                        this.shotControl === 'flick' &&
                        (this.reading?.closed ?? false),
                    phase:
                        this.shotControl === 'flick'
                            ? (this.flickReading?.phase ?? 'idle')
                            : 'idle',
                    gesture:
                        this.shotControl === 'flick'
                            ? (this.flickReading?.gesture ?? null)
                            : null,
                    lastOpenSpeed: this.lastFlick?.openSpeed ?? null,
                    lastRiseMs: this.lastFlick?.riseMs ?? null,
                    lastPower: this.lastFlick?.power ?? null,
                    lastResult: this.lastFlick?.result ?? null,
                },
                frames: this.frames,
                cameraFps: this.cameraFps,
                ...this.summary,
            },
        }
    }

    private emit(): void {
        this.lastEmitAt = this.env.now()
        this.snapshot = this.buildSnapshot()
        for (const listener of this.listeners) listener()
    }
}
