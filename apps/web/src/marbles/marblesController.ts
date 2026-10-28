import {
    type BeteRound,
    type BeteSnapshot,
    DEFAULT_PHYSICS,
    type FlickDetector,
    type FlickPhase,
    type FlickReading,
    type FlickRelease,
    type HandGesture,
    type PinchDetector,
    type PinchReading,
    type Vec,
    createBeteRound,
    createFlickDetector,
    createPinchDetector,
    flickPower,
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
export type MarblesMode = 'pinch' | 'flick'

/** Lê `?mode=estalo` da URL; qualquer outro valor mantém a pinça. */
export function modeFromSearch(search: string): MarblesMode {
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
}

/** Acesso aos elementos da tela, entregue na montagem (nunca durante a renderização). */
export interface MarblesSurfaces {
    getVideo: () => HTMLVideoElement | null
    getOverlay: () => HTMLCanvasElement | null
}

/** Números do painel de depuração. */
export interface MarblesDebug {
    delegate: TrackerDelegate | null
    /** Razão da pinça (distância das pontas dividida pela escala da mão). */
    ratio: number | null
    pinchClosed: boolean
    handVisible: boolean
    /** Quadros processados pelo detector desde que o jogo começou. */
    frames: number
    /** Quadros novos que a câmera entregou por segundo, na última janela de 1 s; `null` até fechar a primeira. */
    cameraFps: number | null
    medianMs: number | null
    p95Ms: number | null
    /** Números do estalo (só têm sentido no modo estalo). */
    flick: {
        armed: boolean
        /** Etapa do estalo: sem armar, armado (polegar preso) ou confirmando o polegar esticado. */
        phase: FlickPhase
        /** Gesto pronto que o reconhecedor viu no último quadro (punho, palma aberta, polegar para cima…). */
        gesture: HandGesture | null
        /** Pico da velocidade de abertura do último estalo, em razão por segundo. */
        lastOpenSpeed: number | null
        lastRiseMs: number | null
        /** Força do último estalo disparado, de 0 a 1 (escala logarítmica da velocidade de abertura). */
        lastPower: number | null
        lastResult: FlickOutcome | null
    }
}

/** Foto imutável do jogo, entregue à interface a cada mudança. */
export interface MarblesSnapshot {
    mode: MarblesMode
    round: BeteSnapshot
    trackerStatus: MarblesTrackerStatus
    /** Posição da pinça no campo e se está fechada; `null` quando a mão não é vista. */
    hand: { point: Vec; closed: boolean } | null
    debug: MarblesDebug
}

const LATENCY_WINDOW = 300
const PUBLISH_INTERVAL_MS = 100
const SUMMARY_INTERVAL_MS = 250
const ANIMATING = ['aiming', 'rolling', 'hit']
const CAMERA_FPS_WINDOW_MS = 1000

const messageOf = (error: unknown) =>
    error instanceof Error && error.message ? error.message : 'Falha ao usar o detector de mão.'

/**
 * Orquestra câmera, detector de mão, detector de pinça e rodada do bete, sem
 * depender do React: a interface assina as mudanças (`subscribe`/`getSnapshot`).
 * O laço por quadro roda enquanto a câmera e o detector estão ativos: lê um
 * quadro novo do vídeo, mede a pinça, alimenta a rodada, avança a física e
 * desenha o esqueleto da mão. Nada é gravado nem enviado.
 */
export class MarblesController {
    private readonly env: MarblesEnv
    private readonly listeners = new Set<() => void>()
    private readonly pinch: PinchDetector = createPinchDetector()
    private readonly flick: FlickDetector = createFlickDetector()
    private mode: MarblesMode
    private lastFlick: {
        openSpeed: number
        riseMs: number
        power: number | null
        result: FlickOutcome
    } | null = null
    private round: BeteRound = createBeteRound()
    private tracker: HandTracker | null = null
    private trackerStatus: MarblesTrackerStatus = 'idle'
    private cameraActive = false
    private cameraFailed = false
    private attached = false
    private surfaces: MarblesSurfaces = { getVideo: () => null, getOverlay: () => null }
    private loadToken = 0
    private loop: number | null = null
    private lastVideoTime = -1
    /** Espera pelo próximo quadro da câmera (`requestVideoFrameCallback`), quando o navegador oferece. */
    private cameraFrameHandle: number | null = null
    private cameraFrameVideo: HTMLVideoElement | null = null
    /** Chegou um quadro novo da câmera que o laço ainda não processou. */
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

    constructor(env: MarblesEnv, mode: MarblesMode = 'pinch') {
        this.env = env
        this.mode = mode
        this.snapshot = this.buildSnapshot()
    }

    readonly subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener)
        return () => {
            this.listeners.delete(listener)
        }
    }

    readonly getSnapshot = (): MarblesSnapshot => this.snapshot

    /** Liga o controlador (montagem da tela); pode ser religado após `detach`. */
    attach(surfaces: MarblesSurfaces): void {
        this.surfaces = surfaces
        this.attached = true
        this.sync()
    }

    /** Desliga: encerra o laço, invalida carregamentos em curso e libera o detector. */
    detach(): void {
        this.attached = false
        this.loadToken++
        this.stopLoop()
        this.tracker?.close()
        this.tracker = null
        this.trackerStatus = 'idle'
        // Atualiza a foto sem avisar os assinantes: a tela está sendo desmontada.
        this.snapshot = this.buildSnapshot()
    }

    setCamera(active: boolean, failed: boolean): void {
        this.cameraActive = active
        this.cameraFailed = failed
        this.sync()
    }

    readonly newRound = (): void => {
        if (this.round.state === 'tracker_error') {
            this.resetAll()
        } else {
            this.round.newRound()
            this.pinch.reset()
            this.flick.reset()
            this.lastFlick = null
        }
        this.sync()
    }

    /** Troca o modo de tiro e reinicia a rodada (tiros zerados). */
    readonly setMode = (mode: MarblesMode): void => {
        if (mode === this.mode) return
        this.mode = mode
        this.newRound()
    }

    private resetAll(): void {
        this.stopLoop()
        this.clearOverlay()
        this.round = createBeteRound()
        this.pinch.reset()
        this.flick.reset()
        this.lastFlick = null
        this.reading = null
        this.flickReading = null
        this.frames = 0
        this.latencies = []
        if (this.trackerStatus === 'error') this.trackerStatus = 'idle'
    }

    /** Acompanha a câmera e o detector com o estado da rodada e publica a foto. */
    private sync(): void {
        this.reconcile()
        if (this.attached && this.cameraActive && this.trackerStatus === 'idle') this.loadTracker()
        this.ensureLoop()
        this.emit()
    }

    private reconcile(): void {
        const { state } = this.round
        if (this.cameraFailed) {
            if (state === 'idle' || state === 'ready') this.round.denyCamera()
        } else if (!this.cameraActive) {
            if (state !== 'idle' && state !== 'camera_denied') this.resetAll()
        } else if (
            (state === 'idle' || state === 'camera_denied') &&
            this.trackerStatus === 'ready'
        ) {
            this.round.cameraReady()
        }
    }

    private loadTracker(): void {
        const token = ++this.loadToken
        this.trackerStatus = 'loading'
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
                this.round.trackerFailed(messageOf(error))
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
            this.trackerStatus !== 'ready' ||
            this.round.state === 'tracker_error'
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
                if (this.mode === 'flick') {
                    const reading = this.flick.update(
                        hand?.landmarks ?? null,
                        aspect,
                        now,
                        hand?.gesture ?? null,
                    )
                    this.reading = reading
                    this.flickReading = reading
                    const shotsBefore = this.round.snapshot().shots
                    this.round.observeFlick(reading, now)
                    if (reading.release) {
                        const fired = this.round.snapshot().shots > shotsBefore
                        this.lastFlick = {
                            openSpeed: reading.release.openSpeed,
                            riseMs: reading.release.riseMs,
                            power: fired ? (flickPower(reading.release)?.power ?? null) : null,
                            result: flickOutcome(reading.release, fired),
                        }
                    }
                } else {
                    this.flickReading = null
                    this.reading = this.pinch.update(hand?.landmarks ?? null, aspect)
                    this.round.observePinch(this.reading, now)
                }
                const canvas = this.surfaces.getOverlay()
                if (canvas) drawHand(canvas, video, hand?.landmarks ?? null)
            } catch (error) {
                this.trackerStatus = 'error'
                this.round.trackerFailed(messageOf(error))
                this.unwatchCameraFrames()
                this.clearOverlay()
                this.emit()
                return
            }
        }

        this.round.advance(dt)
        if (
            processedFrame ||
            ANIMATING.includes(this.round.state) ||
            now - this.lastEmitAt >= PUBLISH_INTERVAL_MS
        ) {
            this.emit()
        }
        this.loop = env.requestFrame(this.step)
    }

    private stopLoop(): void {
        if (this.loop !== null) this.env.cancelFrame(this.loop)
        this.loop = null
        this.unwatchCameraFrames()
    }

    /**
     * Pede ao vídeo que avise cada quadro NOVO da câmera. Num fluxo ao vivo,
     * `currentTime` pode mudar a cada quadro de exibição, então ele não prova
     * que a câmera entregou algo novo; sem `requestVideoFrameCallback` (por
     * exemplo no jsdom) o laço recua para a comparação de `currentTime`.
     */
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

    /** Diz se há um quadro novo da câmera para processar neste passo (e o consome). */
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

    /** Conta um quadro novo da câmera e fecha a janela de 1 s com a taxa observada. */
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

    private buildSnapshot(): MarblesSnapshot {
        const now = this.env.now()
        if (
            now - this.lastSummaryAt >= SUMMARY_INTERVAL_MS ||
            (this.summary.medianMs === null && this.latencies.length > 0)
        ) {
            this.summary = summarizeLatency(this.latencies)
            this.lastSummaryAt = now
        }
        return {
            mode: this.mode,
            round: this.round.snapshot(),
            trackerStatus: this.trackerStatus,
            hand: this.handOnField(),
            debug: {
                delegate: this.delegate,
                ratio: this.reading?.ratio ?? null,
                pinchClosed: this.reading?.closed ?? false,
                handVisible: this.reading?.handVisible ?? false,
                flick: {
                    armed: this.mode === 'flick' && (this.reading?.closed ?? false),
                    phase: this.mode === 'flick' ? (this.flickReading?.phase ?? 'idle') : 'idle',
                    gesture: this.mode === 'flick' ? (this.flickReading?.gesture ?? null) : null,
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
