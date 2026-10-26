import {
    type Card,
    createRound,
    DEFAULT_MAX_DURATION_MS,
    handAngleDeg,
    type Round,
    type RoundState,
} from '@guess-my-move/core'

import { type CreateHandTracker, type HandTracker } from '../tracker/handTracker.js'
import { type DebugInfo, EMPTY_DEBUG } from './debugInfo.js'
import { drawHand } from './handOverlay.js'
import { summarizeLatency } from './latency.js'

export type TrackerStatus = 'idle' | 'loading' | 'ready' | 'error'

/** Dependências do controlador; em testes, o relógio e os quadros são controlados. */
export interface GestureEnv {
    createTracker: CreateHandTracker
    requestFrame: (callback: () => void) => number
    cancelFrame: (handle: number) => void
    /** Relógio monotônico em ms; também é o relógio da rodada. */
    now: () => number
}

export interface GestureControllerOptions {
    card: Card
    env: GestureEnv
}

/** Acesso aos elementos da tela, entregue na montagem (nunca durante a renderização). */
export interface GestureSurfaces {
    getVideo: () => HTMLVideoElement | null
    getOverlay: () => HTMLCanvasElement | null
}

/** Foto imutável do estado, entregue à interface a cada mudança. */
export interface GestureSnapshot {
    state: RoundState
    trackerStatus: TrackerStatus
    /** Motivo da falha do detector, quando a rodada terminou em `tracker_error`. */
    failureReason: string | null
    canStart: boolean
    finished: boolean
    elapsedMs: number | null
    maxDurationMs: number
    debug: DebugInfo
}

const LATENCY_WINDOW = 300
const PUBLISH_INTERVAL_MS = 100

/** Estados em que uma falha do detector ainda pode encerrar a rodada. */
const FAILABLE: readonly RoundState[] = ['card_revealed', 'camera_ready', 'detecting']

const messageOf = (error: unknown) =>
    error instanceof Error && error.message ? error.message : 'Falha ao usar o detector de mão.'

/**
 * Orquestra câmera, detector de mão e rodada do núcleo, sem depender do React:
 * a interface assina as mudanças (`subscribe`/`getSnapshot`). O laço por quadro
 * roda só durante `detecting`: lê um quadro novo do vídeo, calcula o ângulo da
 * mão, alimenta a rodada e desenha o esqueleto. Nada é gravado nem enviado.
 */
export class GestureController {
    private readonly options: GestureControllerOptions
    private readonly listeners = new Set<() => void>()
    private round: Round
    private tracker: HandTracker | null = null
    private trackerStatus: TrackerStatus = 'idle'
    private cameraActive = false
    private cameraFailed = false
    private attached = false
    private surfaces: GestureSurfaces = { getVideo: () => null, getOverlay: () => null }
    private loadToken = 0
    private loop: number | null = null
    private lastVideoTime = -1
    private lastAngle: number | null = null
    private frames = 0
    private latencies: number[] = []
    private lastPublishAt = 0
    private debug: DebugInfo = EMPTY_DEBUG
    private elapsedMs: number | null = null
    private snapshot: GestureSnapshot

    constructor(options: GestureControllerOptions) {
        this.options = options
        this.round = this.makeRound()
        this.snapshot = this.buildSnapshot()
    }

    readonly subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener)
        return () => {
            this.listeners.delete(listener)
        }
    }

    readonly getSnapshot = (): GestureSnapshot => this.snapshot

    /** Liga o controlador (montagem da tela); pode ser religado após `detach`. */
    attach(surfaces: GestureSurfaces): void {
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
    }

    setCamera(active: boolean, failed: boolean): void {
        this.cameraActive = active
        this.cameraFailed = failed
        this.sync()
    }

    readonly start = (): void => {
        if (this.round.state !== 'camera_ready') return
        this.latencies = []
        this.frames = 0
        this.lastAngle = null
        this.lastVideoTime = -1
        this.round.start()
        this.publish()
        this.stopLoop()
        this.loop = this.options.env.requestFrame(this.step)
        this.emit()
    }

    readonly cancel = (): void => {
        this.round.cancel()
        this.stopLoop()
        this.clearOverlay()
        this.publish()
        this.emit()
    }

    readonly newRound = (): void => {
        this.resetRound()
        this.sync()
    }

    private makeRound(): Round {
        const round = createRound({ card: this.options.card, clock: () => this.options.env.now() })
        round.revealCard()
        return round
    }

    private resetRound(): void {
        this.stopLoop()
        this.clearOverlay()
        this.latencies = []
        this.frames = 0
        this.lastAngle = null
        this.round = this.makeRound()
        this.debug = { ...EMPTY_DEBUG, delegate: this.debug.delegate }
        this.elapsedMs = null
        if (this.trackerStatus === 'error') this.trackerStatus = 'idle'
    }

    /** Acompanha a câmera e o detector com o estado da rodada e publica a foto. */
    private sync(): void {
        this.reconcile()
        if (this.attached && this.cameraActive && this.trackerStatus === 'idle') this.loadTracker()
        this.emit()
    }

    private reconcile(): void {
        const { state } = this.round
        if (state === 'card_revealed') {
            if (this.cameraFailed) this.round.denyCamera()
            else if (this.cameraActive && this.trackerStatus === 'ready') this.round.cameraReady()
        } else if (state === 'camera_denied' && this.cameraActive) {
            this.resetRound()
            this.reconcile()
        } else if (!this.cameraActive) {
            if (state === 'detecting') {
                this.round.cancel()
                this.stopLoop()
                this.clearOverlay()
                this.publish()
            } else if (state === 'camera_ready') {
                this.resetRound()
            }
        }
    }

    private loadTracker(): void {
        const token = ++this.loadToken
        this.trackerStatus = 'loading'
        this.options.env.createTracker().then(
            (tracker) => {
                if (token !== this.loadToken || !this.attached) {
                    tracker.close()
                    return
                }
                this.tracker = tracker
                this.debug = { ...this.debug, delegate: tracker.delegate }
                this.trackerStatus = 'ready'
                this.sync()
            },
            (error: unknown) => {
                if (token !== this.loadToken || !this.attached) return
                this.trackerStatus = 'error'
                if (FAILABLE.includes(this.round.state)) this.round.trackerFailed(messageOf(error))
                this.sync()
            },
        )
    }

    private readonly step = (): void => {
        this.loop = null
        const tracker = this.tracker
        const video = this.surfaces.getVideo()
        if (this.round.state !== 'detecting' || !tracker || !video) return
        const { env } = this.options

        this.round.tick()
        if (
            this.round.state === 'detecting' &&
            video.readyState >= 2 &&
            video.videoWidth > 0 &&
            video.currentTime !== this.lastVideoTime
        ) {
            this.lastVideoTime = video.currentTime
            const startedAt = env.now()
            try {
                const hand = tracker.detect(video, startedAt)
                this.latencies.push(env.now() - startedAt)
                if (this.latencies.length > LATENCY_WINDOW) this.latencies.shift()
                this.frames++
                const angle = hand
                    ? handAngleDeg(hand.landmarks, video.videoWidth / video.videoHeight)
                    : null
                this.lastAngle = angle
                if (angle !== null) this.round.observe(angle)
                const canvas = this.surfaces.getOverlay()
                if (canvas) drawHand(canvas, video, hand?.landmarks ?? null)
            } catch (error) {
                this.round.trackerFailed(messageOf(error))
            }
        }

        if (this.round.finished) {
            this.clearOverlay()
            this.publish()
            this.emit()
            return
        }
        if (env.now() - this.lastPublishAt >= PUBLISH_INTERVAL_MS) {
            this.publish()
            this.emit()
        }
        this.loop = env.requestFrame(this.step)
    }

    private stopLoop(): void {
        if (this.loop !== null) this.options.env.cancelFrame(this.loop)
        this.loop = null
    }

    private clearOverlay(): void {
        const canvas = this.surfaces.getOverlay()
        const video = this.surfaces.getVideo()
        if (canvas && video) drawHand(canvas, video, null)
    }

    private publish(): void {
        this.debug = {
            delegate: this.tracker?.delegate ?? this.debug.delegate,
            angleDeg: this.lastAngle,
            reversals: this.round.verdict?.reversals ?? 0,
            windowSamples: this.round.verdict?.windowSamples ?? 0,
            frames: this.frames,
            ...summarizeLatency(this.latencies),
        }
        this.elapsedMs = this.round.elapsedMs
        this.lastPublishAt = this.options.env.now()
    }

    private buildSnapshot(): GestureSnapshot {
        return {
            state: this.round.state,
            trackerStatus: this.trackerStatus,
            failureReason: this.round.failureReason,
            canStart: this.round.state === 'camera_ready',
            finished: this.round.finished,
            elapsedMs: this.elapsedMs,
            maxDurationMs: DEFAULT_MAX_DURATION_MS,
            debug: this.debug,
        }
    }

    private emit(): void {
        this.snapshot = this.buildSnapshot()
        for (const listener of this.listeners) listener()
    }
}
