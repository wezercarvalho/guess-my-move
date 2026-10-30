import {
    type AimController,
    type Body,
    type BotPlanner,
    type Competitor,
    type FlickDetector,
    type FlickPhase,
    type FlickReading,
    type FlickRelease,
    type FieldDecor,
    type HandGesture,
    type Mode,
    type ModeEntry,
    type MatchPhase,
    type MatchSession,
    type Opponent,
    type Outcome,
    type PinchDetector,
    type PinchReading,
    type ShotSource,
    type Vec,
    DEFAULT_PHYSICS,
    createAimController,
    createBotPlanner,
    createFlickDetector,
    createMatchSession,
    createPinchDetector,
    flickPower,
    modes,
} from '@guess-my-move/marbles'

import { drawHand } from '../round/handOverlay.js'
import { summarizeLatency } from '../round/latency.js'
import {
    type CreateHandTracker,
    type HandTracker,
    type TrackerDelegate,
} from '../tracker/handTracker.js'

export type MarblesTrackerStatus = 'idle' | 'loading' | 'ready' | 'error'

/** Modo de tiro: a pinça com arrasto (padrão) ou o estalo do polegar (alpha). */
export type ShotControl = 'pinch' | 'flick'

/** Lê `?mode=estalo` da URL; qualquer outro valor mantém a pinça. */
export function shotControlFromSearch(search: string): ShotControl {
    return new URLSearchParams(search).get('mode')?.toLowerCase() === 'estalo' ? 'flick' : 'pinch'
}

/** O que aconteceu no último estalo, para a depuração. */
export type FlickOutcome =
    | 'disparado'
    | 'fraco demais'
    | 'não sustentado'
    | 'mão aberta'
    | 'sem mira'

function flickOutcome(release: FlickRelease, fired: boolean): FlickOutcome {
    if (release.verdict === 'weak') return 'fraco demais'
    if (release.verdict === 'unsustained') return 'não sustentado'
    if (release.verdict === 'open_hand') return 'mão aberta'
    return fired ? 'disparado' : 'sem mira'
}

/** Dependências do controlador; em testes, o relógio e os quadros são controlados. */
export interface MarblesEnv {
    createTracker: CreateHandTracker
    requestFrame: (callback: () => void) => number
    cancelFrame: (handle: number) => void
    /** Relógio monotônico em ms. */
    now: () => number
    /** Planejador do bot (injetável para teste); por padrão, `DEFAULT_BOT`. */
    createBot?: () => BotPlanner
    /** Semente base da partida contra o bot (injetável para teste). */
    seed?: number
}

/** Acesso aos elementos da tela, entregue na montagem (nunca durante a renderização). */
export interface MarblesSurfaces {
    getVideo: () => HTMLVideoElement | null
    getOverlay: () => HTMLCanvasElement | null
}

/** Números do painel de depuração. */
export interface MarblesDebug {
    delegate: TrackerDelegate | null
    ratio: number | null
    pinchClosed: boolean
    handVisible: boolean
    frames: number
    cameraFps: number | null
    medianMs: number | null
    p95Ms: number | null
    flick: {
        armed: boolean
        phase: FlickPhase
        gesture: HandGesture | null
        lastOpenSpeed: number | null
        lastRiseMs: number | null
        lastPower: number | null
        lastResult: FlickOutcome | null
    }
}

/** Mira em andamento, exposta à tela para o campo desenhar o elástico/seta. */
export interface AimView {
    pinch: Vec
    shot: { velocity: Vec; power: number } | null
    direction: Vec | null
}

/** Estado da partida exposto à tela. */
export interface MatchView {
    modeId: string
    opponent: Opponent
    phase: MatchPhase
    round: number
    roundsPerMatch: number
    roundOutcomes: Outcome[]
    lastRoundOutcome: Outcome | null
    matchOutcome: Outcome | null
    turn: Competitor | null
    playerShotsLeft: number
    roundYield: Record<Competitor, number>
    scoreLabel: string | null
    field: Body[]
    decor: FieldDecor | null
}

/** Foto imutável do jogo, entregue à interface a cada mudança. */
export interface MarblesSnapshot {
    /** `true` antes de a partida começar (tela inicial de escolha). */
    choosing: boolean
    modeId: string
    opponent: Opponent
    shotControl: ShotControl
    trackerStatus: MarblesTrackerStatus
    /** Câmera negada, indisponível ou falhou. */
    cameraFailed: boolean
    /** Motivo da falha do detector; `null` quando não há falha. */
    failureReason: string | null
    /** A partida em andamento; `null` enquanto na tela de escolha. */
    match: MatchView | null
    /** Mira em andamento (só na vez do jogador). */
    aim: AimView | null
    /** Posição da pinça no campo e se está fechada; `null` quando a mão não é vista. */
    hand: { point: Vec; closed: boolean } | null
    debug: MarblesDebug
}

const LATENCY_WINDOW = 300
const PUBLISH_INTERVAL_MS = 100
const SUMMARY_INTERVAL_MS = 250
const CAMERA_FPS_WINDOW_MS = 1000
/** Espera curta (ms) mostrando o resultado da rodada antes de começar a próxima. */
const ROUND_DWELL_MS = 900

const messageOf = (error: unknown) =>
    error instanceof Error && error.message ? error.message : 'Falha ao usar o detector de mão.'

function modeEntry(modeId: string): ModeEntry {
    return modes.find((m) => m.id === modeId) ?? modes[0]
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
    private readonly pinch: PinchDetector = createPinchDetector()
    private readonly flick: FlickDetector = createFlickDetector()
    private readonly botPlanner: BotPlanner
    private readonly aim: AimController = createAimController({
        width: DEFAULT_PHYSICS.width,
        height: DEFAULT_PHYSICS.height,
    })

    // Escolha da tela inicial.
    private modeId: string
    private opponent: Opponent = 'target'
    private shotControl: ShotControl

    // Partida em andamento.
    private session: MatchSession | null = null
    private aimView: AimView | null = null
    private roundDwellUntil: number | null = null

    private lastFlick: {
        openSpeed: number
        riseMs: number
        power: number | null
        result: FlickOutcome
    } | null = null

    private tracker: HandTracker | null = null
    private trackerStatus: MarblesTrackerStatus = 'idle'
    private failureReason: string | null = null
    private cameraActive = false
    private cameraFailed = false
    private attached = false
    private surfaces: MarblesSurfaces = { getVideo: () => null, getOverlay: () => null }
    private loadToken = 0
    private loop: number | null = null
    private lastVideoTime = -1
    private cameraFrameHandle: number | null = null
    private cameraFrameVideo: HTMLVideoElement | null = null
    private cameraFramePending = false
    private cameraFps: number | null = null
    private cameraWindowStart: number | null = null
    private cameraWindowCount = 0
    private lastNow: number | null = null
    private frames = 0
    private latencies: number[] = []
    private reading: PinchReading | null = null
    private flickReading: FlickReading | null = null
    private delegate: TrackerDelegate | null = null
    private summary = summarizeLatency([])
    private lastSummaryAt = 0
    private lastEmitAt = 0
    private snapshot: MarblesSnapshot

    constructor(env: MarblesEnv, shotControl: ShotControl = 'pinch') {
        this.env = env
        this.shotControl = shotControl
        this.modeId = modes[0].id
        this.botPlanner = (env.createBot ?? createBotPlanner)()
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
        this.loadToken++
        this.stopLoop()
        this.tracker?.close()
        this.tracker = null
        this.trackerStatus = 'idle'
        this.snapshot = this.buildSnapshot()
    }

    setCamera(active: boolean, failed: boolean): void {
        this.cameraActive = active
        this.cameraFailed = failed
        this.sync()
    }

    /** Escolhe o modo na tela inicial (sem efeito durante a partida). */
    readonly setMode = (modeId: string): void => {
        if (this.session) return
        if (!modes.some((m) => m.id === modeId)) return
        this.modeId = modeId
        this.sync()
    }

    /** Escolhe o adversário na tela inicial (sem efeito durante a partida). */
    readonly setOpponent = (opponent: Opponent): void => {
        if (this.session) return
        this.opponent = opponent
        this.sync()
    }

    /** Troca o controle de tiro (pinça/estalo); zera a mira em andamento. */
    readonly setShotControl = (control: ShotControl): void => {
        if (control === this.shotControl) return
        this.shotControl = control
        this.pinch.reset()
        this.flick.reset()
        this.aim.reset()
        this.lastFlick = null
        this.aimView = null
        this.sync()
    }

    /** Começa a partida com o modo e o adversário escolhidos. */
    readonly startMatch = (): void => {
        const entry = modeEntry(this.modeId)
        const mode: Mode = entry.create()
        this.session = createMatchSession({
            modeId: entry.id,
            mode,
            opponent: this.opponent,
            bot: this.makeBotSource(entry, mode),
        })
        this.aim.reset()
        this.pinch.reset()
        this.flick.reset()
        this.lastFlick = null
        this.aimView = null
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
        this.aimView = null
        this.roundDwellUntil = null
        this.aim.reset()
        this.pinch.reset()
        this.flick.reset()
        this.lastFlick = null
        this.sync()
    }

    /**
     * Fonte do tiro do bot: mira o ponto do modo e planeja com a semente da
     * partida. Sem semente injetada (produção), cada partida sorteia a sua, para
     * a sequência de acertos e erros do bot não se repetir de uma partida à outra.
     */
    private makeBotSource(entry: ModeEntry, mode: Mode): ShotSource {
        const aimPoint = entry.botAimPoint(mode)
        const planner = this.botPlanner
        const seedBase = this.env.seed ?? Math.floor(Math.random() * 0x1_0000_0000)
        let shot = 0
        return {
            nextShot(field?: readonly Body[]): Vec | null {
                shot++
                if (!field || field.length === 0) return { x: 300, y: 0 }
                const origin = field[0].pos
                const point = aimPoint(field, 'opponent')
                if (!point) return { x: 300, y: 0 }
                return planner.planShot(origin, point, seedBase + shot * 101)
            },
        }
    }

    private sync(): void {
        this.reconcile()
        if (this.attached && this.cameraActive && this.trackerStatus === 'idle') this.loadTracker()
        this.ensureLoop()
        this.emit()
    }

    private reconcile(): void {
        if (!this.cameraActive && !this.cameraFailed) {
            // Câmera desligada: o detector é liberado; a partida escolhida é preservada.
            if (this.trackerStatus === 'ready' || this.trackerStatus === 'loading') {
                this.releaseTracker()
            }
        }
    }

    private releaseTracker(): void {
        this.loadToken++
        this.stopLoop()
        this.tracker?.close()
        this.tracker = null
        this.trackerStatus = 'idle'
        this.delegate = null
        this.reading = null
        this.flickReading = null
    }

    private loadTracker(): void {
        if (this.cameraFailed) return
        const token = ++this.loadToken
        this.trackerStatus = 'loading'
        this.failureReason = null
        this.env.createTracker().then(
            (tracker) => {
                if (token !== this.loadToken || !this.attached) {
                    tracker.close()
                    return
                }
                this.tracker = tracker
                this.delegate = tracker.delegate
                this.trackerStatus = 'ready'
                this.sync()
            },
            (error: unknown) => {
                if (token !== this.loadToken || !this.attached) return
                this.trackerStatus = 'error'
                this.failureReason = messageOf(error)
                this.sync()
            },
        )
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
        this.lastVideoTime = -1
        this.cameraFramePending = false
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

        if (video.readyState >= 2 && video.videoWidth > 0 && this.takeNewCameraFrame(video, now)) {
            processedFrame = true
            try {
                const hand = tracker.detect(video, now)
                this.latencies.push(env.now() - now)
                if (this.latencies.length > LATENCY_WINDOW) this.latencies.shift()
                this.frames++
                const aspect = video.videoWidth / video.videoHeight
                this.readHand(hand, aspect, now)
                const canvas = this.surfaces.getOverlay()
                if (canvas) drawHand(canvas, video, hand?.landmarks ?? null)
            } catch (error) {
                this.trackerStatus = 'error'
                this.failureReason = messageOf(error)
                this.releaseTracker()
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

    /** Lê a mão no quadro e, na vez do jogador, alimenta o controlador de mira. */
    private readHand(hand: ReturnType<HandTracker['detect']>, aspect: number, now: number): void {
        const session = this.session
        const shooter = session?.shooter() ?? null
        const awaiting = session?.awaitingPlayerShot() ?? false

        if (this.shotControl === 'flick') {
            const reading = this.flick.update(
                hand?.landmarks ?? null,
                aspect,
                now,
                hand?.gesture ?? null,
            )
            this.reading = reading
            this.flickReading = reading
            if (awaiting && shooter) this.feedFlick(shooter, reading, now)
            else if (reading.release) this.aim.reset()
        } else {
            this.flickReading = null
            const reading = this.pinch.update(hand?.landmarks ?? null, aspect)
            this.reading = reading
            if (awaiting && shooter) this.feedPinch(shooter, reading, now)
        }
    }

    private feedPinch(shooter: Vec, reading: PinchReading, now: number): void {
        const out = this.aim.observePinch(shooter, reading, now)
        this.aimView = out.aiming
            ? { pinch: out.aiming.pinch, shot: out.aiming.shot, direction: null }
            : null
        if (out.fired) {
            this.session?.firePlayerShot(out.fired)
            this.aimView = null
        }
    }

    private feedFlick(shooter: Vec, reading: FlickReading, now: number): void {
        const out = this.aim.observeFlick(shooter, reading, now)
        this.aimView = out.aiming
            ? { pinch: out.aiming.pinch, shot: null, direction: out.aiming.direction }
            : null
        if (reading.release) {
            const fired = out.fired !== null
            this.lastFlick = {
                openSpeed: reading.release.openSpeed,
                riseMs: reading.release.riseMs,
                power: fired ? (flickPower(reading.release)?.power ?? null) : null,
                result: flickOutcome(reading.release, fired),
            }
        }
        if (out.fired) {
            this.session?.firePlayerShot(out.fired)
            this.aimView = null
        }
    }

    /** Avança a partida: anima a rolagem e, após a rodada, aguarda e começa a próxima. */
    private advanceMatch(dt: number, now: number): void {
        const session = this.session
        if (!session) return
        const phase = session.snapshot().phase
        if (phase === 'round-over') {
            if (this.roundDwellUntil === null) this.roundDwellUntil = now + ROUND_DWELL_MS
            else if (now >= this.roundDwellUntil) {
                this.roundDwellUntil = null
                session.beginNextRound()
                this.aim.reset()
            }
            return
        }
        this.roundDwellUntil = null
        session.advance(dt)
    }

    private stopLoop(): void {
        if (this.loop !== null) this.env.cancelFrame(this.loop)
        this.loop = null
        this.unwatchCameraFrames()
    }

    private watchCameraFrames(): void {
        const video = this.surfaces.getVideo()
        this.unwatchCameraFrames()
        if (!video || typeof video.requestVideoFrameCallback !== 'function') return
        this.cameraFrameVideo = video
        const arm = (): void => {
            this.cameraFrameHandle = video.requestVideoFrameCallback(() => {
                this.cameraFramePending = true
                this.countCameraFrame(this.env.now())
                arm()
            })
        }
        arm()
    }

    private unwatchCameraFrames(): void {
        const video = this.cameraFrameVideo
        if (video && this.cameraFrameHandle !== null) {
            video.cancelVideoFrameCallback(this.cameraFrameHandle)
        }
        this.cameraFrameHandle = null
        this.cameraFrameVideo = null
        this.cameraFramePending = false
    }

    private takeNewCameraFrame(video: HTMLVideoElement, now: number): boolean {
        if (this.cameraFrameVideo === video) {
            if (!this.cameraFramePending) return false
            this.cameraFramePending = false
            return true
        }
        if (video.currentTime === this.lastVideoTime) return false
        this.lastVideoTime = video.currentTime
        this.countCameraFrame(now)
        return true
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
        const session = this.session
        if (!session) return null
        const snap = session.snapshot()
        return {
            modeId: snap.modeId,
            opponent: snap.opponent,
            phase: snap.phase,
            round: snap.round,
            roundsPerMatch: snap.roundsPerMatch,
            roundOutcomes: snap.roundOutcomes,
            lastRoundOutcome: snap.lastRoundOutcome,
            matchOutcome: snap.matchOutcome,
            turn: snap.turn,
            playerShotsLeft: snap.playerShotsLeft,
            roundYield: snap.roundYield,
            scoreLabel: snap.scoreLabel,
            field: snap.field,
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
        // Na vez do bot o gesto é ignorado: nenhuma mira é exposta.
        const playerTurn = this.session?.snapshot().phase === 'player-turn'
        return {
            choosing: this.session === null,
            modeId: this.modeId,
            opponent: this.opponent,
            shotControl: this.shotControl,
            trackerStatus: this.trackerStatus,
            cameraFailed: this.cameraFailed,
            failureReason: this.failureReason,
            match: this.matchView(),
            aim: playerTurn ? this.aimView : null,
            hand: this.handOnField(),
            debug: {
                delegate: this.delegate,
                ratio: this.reading?.ratio ?? null,
                pinchClosed: this.reading?.closed ?? false,
                handVisible: this.reading?.handVisible ?? false,
                flick: {
                    armed: this.shotControl === 'flick' && (this.reading?.closed ?? false),
                    phase: this.shotControl === 'flick' ? (this.flickReading?.phase ?? 'idle') : 'idle',
                    gesture: this.shotControl === 'flick' ? (this.flickReading?.gesture ?? null) : null,
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
