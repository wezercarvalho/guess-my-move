import {
    createPinchDetector,
    createFlickDetector,
    createAimController,
    DEFAULT_PHYSICS,
    flickPower,
    type Vec,
    type PinchReading,
    type FlickReading,
    type FlickRelease,
} from '@guess-my-move/marbles'
import type { TrackedHand } from '../tracker/handTracker.js'
import type { AimView, FlickOutcome, ShotControl } from './marblesTypes.js'

function flickOutcome(release: FlickRelease, fired: boolean): FlickOutcome {
    if (release.verdict === 'weak') return 'fraco demais'
    if (release.verdict === 'unsustained') return 'não sustentado'
    if (release.verdict === 'open_hand') return 'mão aberta'
    return fired ? 'disparado' : 'sem mira'
}

interface FlickFeedback {
    openSpeed: number
    riseMs: number
    power: number | null
    result: FlickOutcome
}
export class MarblesHandInput {
    private readonly pinch = createPinchDetector()
    private readonly flick = createFlickDetector()
    private readonly aim = createAimController({
        width: DEFAULT_PHYSICS.width,
        height: DEFAULT_PHYSICS.height,
    })
    private state: {
        reading: PinchReading | null
        flickReading: FlickReading | null
        aimView: AimView | null
        lastFlick: FlickFeedback | null
    } = { reading: null, flickReading: null, aimView: null, lastFlick: null }
    get reading() {
        return this.state.reading
    }
    get flickReading() {
        return this.state.flickReading
    }
    get aimView() {
        return this.state.aimView
    }
    get lastFlick() {
        return this.state.lastFlick
    }
    clearReadings(): void {
        this.state.reading = null
        this.state.flickReading = null
    }
    resetAim(): void {
        this.aim.reset()
    }
    resetForTurn(): void {
        this.aim.reset()
        this.pinch.reset()
        this.flick.reset()
        this.state.aimView = null
    }
    resetForSession(): void {
        this.resetForTurn()
        this.state.lastFlick = null
    }
    update(
        hand: TrackedHand | null,
        aspect: number,
        now: number,
        shooter: Vec | null,
        awaiting: boolean,
        control: ShotControl,
    ): Vec | null {
        if (control === 'flick') {
            const reading = this.flick.update(
                hand?.landmarks ?? null,
                aspect,
                now,
                hand?.gesture ?? null,
            )
            this.state.reading = reading
            this.state.flickReading = reading
            if (awaiting && shooter)
                return this.feedFlick(shooter, reading, now)
            if (reading.release) this.aim.reset()
        } else {
            this.state.flickReading = null
            const reading = this.pinch.update(hand?.landmarks ?? null, aspect)
            this.state.reading = reading
            if (awaiting && shooter)
                return this.feedPinch(shooter, reading, now)
        }
        return null
    }
    private feedPinch(
        shooter: Vec,
        reading: PinchReading,
        now: number,
    ): Vec | null {
        const out = this.aim.observePinch(shooter, reading, now)
        this.state.aimView = out.aiming
            ? {
                  pinch: out.aiming.pinch,
                  shot: out.aiming.shot,
                  direction: null,
              }
            : null
        if (out.fired) {
            this.state.aimView = null
            return out.fired
        }
        return null
    }

    private feedFlick(
        shooter: Vec,
        reading: FlickReading,
        now: number,
    ): Vec | null {
        const out = this.aim.observeFlick(shooter, reading, now)
        this.state.aimView = out.aiming
            ? {
                  pinch: out.aiming.pinch,
                  shot: null,
                  direction: out.aiming.direction,
              }
            : null
        if (reading.release) {
            const fired = out.fired !== null
            this.state.lastFlick = {
                openSpeed: reading.release.openSpeed,
                riseMs: reading.release.riseMs,
                power: fired
                    ? (flickPower(reading.release)?.power ?? null)
                    : null,
                result: flickOutcome(reading.release, fired),
            }
        }
        if (out.fired) {
            this.state.aimView = null
            return out.fired
        }
        return null
    }
}
