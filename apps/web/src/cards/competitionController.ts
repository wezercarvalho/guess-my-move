import {
    handAngleDeg,
    type CardLocale,
    type CardRoundAccess,
    type CardRoundSnapshot,
} from '@guess-my-move/core'
import { AsyncTrackerResource } from '../capture/asyncTrackerResource.js'
import { VideoFrameGate } from '../capture/videoFrameGate.js'
import type { CreateHandTracker, HandTracker } from '../tracker/handTracker.js'
import type { GestureSurfaces } from '../round/gestureController.js'
import { drawHand } from '../round/handOverlay.js'
import type { CardRoundApi } from './roundApi.js'

export interface CompetitionEnv {
    now(): number
    createTracker: CreateHandTracker
    requestFrame(callback: () => void): number
    cancelFrame(handle: number): void
}
type Status =
    | 'idle'
    | 'loading'
    | 'ready'
    | 'starting'
    | 'playing'
    | 'finished'
    | 'cancelled'
    | 'error'
export interface CompetitionSnapshot {
    failure: 'tracker' | 'server' | null
    status: Status
    canStart: boolean
    remainingMs: number
    round: CardRoundSnapshot | null
}
interface Options {
    cardId: string
    locale: CardLocale
    api: CardRoundApi
    env: CompetitionEnv
}

/** Capture stays local. Only the API can supply a competitive result/score. */
export class CompetitionController {
    private readonly resource = new AsyncTrackerResource<HandTracker>()
    private readonly frames = new VideoFrameGate()
    private readonly listeners = new Set<() => void>()
    private surfaces: GestureSurfaces = {
        getVideo: () => null,
        getOverlay: () => null,
    }
    private snapshot: CompetitionSnapshot = {
        status: 'idle',
        failure: null,
        canStart: false,
        remainingMs: 10000,
        round: null,
    }
    private attached = false
    private cameraActive = false
    private generation = 0
    private abort: AbortController | null = null
    private access: CardRoundAccess | null = null
    private frame: number | null = null
    private inFlight = false
    private seq = 0
    private lastSent = -Infinity
    private lastResponseAt = 0
    private angle: number | null = null
    constructor(private readonly options: Options) {}
    readonly subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener)
        return () => this.listeners.delete(listener)
    }
    readonly getSnapshot = (): CompetitionSnapshot => this.snapshot
    attach(surfaces: GestureSurfaces): void {
        this.surfaces = surfaces
        this.attached = true
        this.syncTracker()
    }
    setCamera(active: boolean): void {
        if (!active && this.cameraActive) {
            this.cancel()
            this.resource.release()
        }
        this.cameraActive = active
        this.syncTracker()
    }
    private syncTracker(): void {
        if (!this.attached || !this.cameraActive) {
            this.patch({ canStart: false })
            return
        }
        this.resource.load(this.options.env.createTracker, {
            alive: () => this.attached && this.cameraActive,
            onReady: () => this.patch({ status: 'ready', canStart: true }),
            onError: () => this.fail('tracker'),
        })
        if (this.resource.status === 'loading')
            this.patch({ status: 'loading', canStart: false })
        else
            this.patch({
                canStart:
                    this.resource.status === 'ready' &&
                    !['starting', 'playing'].includes(this.snapshot.status),
            })
    }
    async start(): Promise<void> {
        if (!this.snapshot.canStart || !this.attached || !this.cameraActive)
            return
        this.stop()
        const generation = ++this.generation
        const abort = new AbortController()
        this.abort = abort
        this.patch({
            status: 'starting',
            failure: null,
            canStart: false,
            round: null,
            remainingMs: 10000,
        })
        try {
            const access = await this.options.api.start(
                { cardId: this.options.cardId, locale: this.options.locale },
                abort.signal,
            )
            if (!this.alive(generation)) {
                void this.options.api.cancel(access).catch(() => undefined)
                return
            }
            this.access = access
            this.seq = 0
            this.lastSent = -Infinity
            this.lastResponseAt = this.options.env.now()
            this.angle = null
            this.inFlight = false
            this.patch({
                status: 'playing',
                round: access.round,
                remainingMs: access.round.maxDurationMs,
            })
            this.frames.watch(this.surfaces.getVideo())
            this.frame = this.options.env.requestFrame(this.step)
        } catch {
            if (this.alive(generation)) this.fail()
        }
    }
    cancel(): void {
        this.generation++
        this.abort?.abort()
        this.abort = null
        const access = this.access
        this.access = null
        this.stop()
        this.patch({
            status: 'cancelled',
            failure: null,
            round: null,
            remainingMs: 0,
            canStart: this.cameraActive && this.resource.status === 'ready',
        })
        if (access) void this.options.api.cancel(access).catch(() => undefined)
    }
    destroy(): void {
        this.attached = false
        this.cancel()
        this.resource.release()
        this.patch({ canStart: false })
        this.listeners.clear()
    }
    private alive(generation: number): boolean {
        return (
            this.attached && this.cameraActive && this.generation === generation
        )
    }
    private readonly step = (): void => {
        this.frame = null
        if (
            this.snapshot.status !== 'playing' ||
            !this.attached ||
            !this.cameraActive
        )
            return
        const now = this.options.env.now()
        const video = this.surfaces.getVideo()
        const tracker = this.resource.value
        try {
            if (
                video &&
                tracker &&
                video.readyState >= 2 &&
                video.videoWidth > 0 &&
                this.frames.take(video, now)
            ) {
                const hand = tracker.detect(video, now)
                this.angle = hand
                    ? handAngleDeg(
                          hand.landmarks,
                          video.videoWidth / video.videoHeight,
                      )
                    : null
                const overlay = this.surfaces.getOverlay()
                if (overlay) drawHand(overlay, video, hand?.landmarks ?? null)
            }
        } catch (error) {
            this.resource.fail(error)
            this.fail('tracker')
            return
        }
        if (
            !this.inFlight &&
            now - this.lastSent >= 120 &&
            this.access &&
            this.abort
        ) {
            const generation = this.generation
            const access = this.access
            this.lastSent = now
            this.inFlight = true
            const angleDeg = this.angle
            this.angle = null
            const elapsed = this.snapshot.round?.elapsedMs ?? 0
            this.patch({
                remainingMs: Math.max(
                    0,
                    (this.snapshot.round?.maxDurationMs ?? 10000) -
                        elapsed -
                        (now - this.lastResponseAt),
                ),
            })
            void this.options.api
                .observe(
                    access,
                    { seq: ++this.seq, angleDeg },
                    this.abort.signal,
                )
                .then(
                    (round) => {
                        if (!this.alive(generation) || access !== this.access)
                            return
                        this.inFlight = false
                        this.lastResponseAt = this.options.env.now()
                        const finished = round.state !== 'detecting'
                        this.patch({
                            round,
                            remainingMs: Math.max(
                                0,
                                round.maxDurationMs - round.elapsedMs,
                            ),
                            status: finished ? 'finished' : 'playing',
                            canStart:
                                finished && this.resource.status === 'ready',
                        })
                        if (finished) {
                            this.access = null
                            this.stop()
                        }
                    },
                    () => {
                        if (this.alive(generation)) this.fail()
                    },
                )
        }
        if (this.snapshot.status === 'playing')
            this.frame = this.options.env.requestFrame(this.step)
    }
    private fail(failure: 'tracker' | 'server' = 'server'): void {
        this.cancel()
        this.patch({
            status: 'error',
            failure,
            round: null,
            canStart:
                this.attached &&
                this.cameraActive &&
                this.resource.status === 'ready',
        })
    }
    private stop(): void {
        if (this.frame !== null) this.options.env.cancelFrame(this.frame)
        this.frame = null
        this.frames.unwatch()
        this.inFlight = false
        const overlay = this.surfaces.getOverlay()
        if (overlay) {
            const context = overlay.getContext('2d')
            context?.clearRect(0, 0, overlay.width, overlay.height)
        }
    }
    private patch(update: Partial<CompetitionSnapshot>): void {
        this.snapshot = { ...this.snapshot, ...update }
        for (const listener of this.listeners) listener()
    }
}
