import {
    type BeteRound,
    type BeteSnapshot,
    type PinchDetector,
    type PinchReading,
    createBeteRound,
    createPinchDetector,
} from '@guess-my-move/marbles'

import { drawHand } from '../round/handOverlay.js'
import { summarizeLatency } from '../round/latency.js'
import {
    type CreateHandTracker,
    type HandTracker,
    type TrackerDelegate,
} from '../tracker/handTracker.js'

export type MarblesTrackerStatus = 'idle' | 'loading' | 'ready' | 'error'

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
    medianMs: number | null
    p95Ms: number | null
}

/** Foto imutável do jogo, entregue à interface a cada mudança. */
export interface MarblesSnapshot {
    round: BeteSnapshot
    trackerStatus: MarblesTrackerStatus
    debug: MarblesDebug
}

const LATENCY_WINDOW = 300
const PUBLISH_INTERVAL_MS = 100
const SUMMARY_INTERVAL_MS = 250
const ANIMATING = ['aiming', 'rolling', 'hit']

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
    private lastNow: number | null = null
    private frames = 0
    private latencies: number[] = []
    private reading: PinchReading | null = null
    private delegate: TrackerDelegate | null = null
    private summary = summarizeLatency([])
    private lastSummaryAt = 0
    private lastEmitAt = 0
    private snapshot: MarblesSnapshot

    constructor(env: MarblesEnv) {
        this.env = env
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
        }
        this.sync()
    }

    private resetAll(): void {
        this.stopLoop()
        this.clearOverlay()
        this.round = createBeteRound()
        this.pinch.reset()
        this.reading = null
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

        if (
            video.readyState >= 2 &&
            video.videoWidth > 0 &&
            video.currentTime !== this.lastVideoTime
        ) {
            this.lastVideoTime = video.currentTime
            try {
                const hand = tracker.detect(video, now)
                this.latencies.push(env.now() - now)
                if (this.latencies.length > LATENCY_WINDOW) this.latencies.shift()
                this.frames++
                this.reading = this.pinch.update(
                    hand?.landmarks ?? null,
                    video.videoWidth / video.videoHeight,
                )
                this.round.observePinch(this.reading, now)
                const canvas = this.surfaces.getOverlay()
                if (canvas) drawHand(canvas, video, hand?.landmarks ?? null)
            } catch (error) {
                this.trackerStatus = 'error'
                this.round.trackerFailed(messageOf(error))
                this.clearOverlay()
                this.emit()
                return
            }
        }

        this.round.advance(dt)
        if (ANIMATING.includes(this.round.state) || now - this.lastEmitAt >= PUBLISH_INTERVAL_MS) {
            this.emit()
        }
        this.loop = env.requestFrame(this.step)
    }

    private stopLoop(): void {
        if (this.loop !== null) this.env.cancelFrame(this.loop)
        this.loop = null
    }

    private clearOverlay(): void {
        const canvas = this.surfaces.getOverlay()
        const video = this.surfaces.getVideo()
        if (canvas && video) drawHand(canvas, video, null)
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
            round: this.round.snapshot(),
            trackerStatus: this.trackerStatus,
            debug: {
                delegate: this.delegate,
                ratio: this.reading?.ratio ?? null,
                pinchClosed: this.reading?.closed ?? false,
                handVisible: this.reading?.handVisible ?? false,
                frames: this.frames,
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
