import type { FaceReading, HeadOrientation } from './headLook.js'
export interface EyePoint {
    x: number
    y: number
}
export const EYE_TARGETS: readonly EyePoint[] = [
    { x: 0.5, y: 0.5 },
    { x: 0.2, y: 0.2 },
    { x: 0.5, y: 0.2 },
    { x: 0.8, y: 0.2 },
    { x: 0.2, y: 0.5 },
    { x: 0.8, y: 0.5 },
    { x: 0.2, y: 0.8 },
    { x: 0.5, y: 0.8 },
    { x: 0.8, y: 0.8 },
]
export const EYE_VALIDATION: readonly EyePoint[] = [
    { x: 0.35, y: 0.35 },
    { x: 0.65, y: 0.35 },
    { x: 0.35, y: 0.65 },
    { x: 0.65, y: 0.65 },
]
export interface EyeView {
    phase: 'off' | 'calibrating' | 'validating' | 'ready' | 'failed'
    index: number
    target: EyePoint | null
    progress: number
    usable: boolean
    error: number | null
}
/** Ratios in each eye's own axes remove common translation/scale/roll. Not a gaze model by themselves. */
export function eyeFeatures(face: FaceReading | null): EyePoint | null {
    if (
        !face?.orientation ||
        !Number.isFinite(face.orientation.yaw) ||
        !Number.isFinite(face.orientation.pitch)
    )
        return null
    const values: EyePoint[] = []
    for (const [a, b, top, bottom, center] of [
        [33, 133, 159, 145, 468],
        [362, 263, 386, 374, 473],
    ]) {
        const l = face.landmarks[a],
            r = face.landmarks[b],
            u = face.landmarks[top],
            d = face.landmarks[bottom],
            c = face.landmarks[center]
        if (
            !l ||
            !r ||
            !u ||
            !d ||
            !c ||
            ![l, r, u, d, c].every(
                (p) => Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1,
            )
        )
            return null
        const left = l.x < r.x ? l : r,
            right = l.x < r.x ? r : l
        const dx = right.x - left.x,
            dy = right.y - left.y,
            width = Math.hypot(dx, dy)
        if (width < 0.015 || Math.hypot(u.x - d.x, u.y - d.y) / width < 0.1)
            return null
        const x = ((c.x - left.x) * dx + (c.y - left.y) * dy) / (width * width)
        const y = (-(c.x - left.x) * dy + (c.y - left.y) * dx) / (width * width)
        if (x < 0.1 || x > 0.9 || Math.abs(y) > 0.4) return null
        values.push({ x, y })
    }
    if (
        Math.abs(values[0].x - values[1].x) > 0.2 ||
        Math.abs(values[0].y - values[1].y) > 0.15
    )
        return null
    return {
        x: (values[0].x + values[1].x) / 2,
        y: (values[0].y + values[1].y) / 2,
    }
}
function solve(rows: number[][], values: number[]): number[] | null {
    const a = Array.from({ length: 3 }, (_, i) => [
        ...Array.from({ length: 3 }, (_, j) =>
            rows.reduce((s, r) => s + r[i] * r[j], 0),
        ),
        rows.reduce((s, r, k) => s + r[i] * values[k], 0),
    ])
    for (let col = 0; col < 3; col++) {
        let pivot = col
        for (let r = col + 1; r < 3; r++)
            if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r
        if (Math.abs(a[pivot][col]) < 1e-8) return null
        ;[a[col], a[pivot]] = [a[pivot], a[col]]
        const scale = a[col][col]
        for (let j = col; j < 4; j++) a[col][j] = a[col][j] / scale
        for (let r = 0; r < 3; r++)
            if (r !== col) {
                const factor = a[r][col]
                for (let j = col; j < 4; j++)
                    a[r][j] = a[r][j] - factor * a[col][j]
            }
    }
    return a.map((r) => r[3])
}
export class EyeAssist {
    private phase: EyeView['phase'] = 'off'
    private index = 0
    private progress = 0
    private origin: HeadOrientation | null = null
    private rows: number[][] = []
    private coefficients: { x: number[]; y: number[] } | null = null
    private errors: number[] = []
    private error: number | null = null
    private window: EyePoint[] = []
    private since: number | null = null
    private lastAt = -Infinity
    private usable = false
    private point: EyePoint | null = null
    private offset = { yaw: 0, pitch: 0 }
    private validSince: number | null = null
    private intentSince: number | null = null
    private intent = ''
    get view(): EyeView {
        const targets =
            this.phase === 'calibrating'
                ? EYE_TARGETS
                : this.phase === 'validating'
                  ? EYE_VALIDATION
                  : []
        return {
            phase: this.phase,
            index: this.index,
            target: targets[this.index] ?? null,
            progress: this.progress,
            usable: this.usable,
            error: this.error,
        }
    }
    enable(enabled: boolean): void {
        this.phase = enabled ? 'calibrating' : 'off'
        this.index = 0
        this.origin = null
        this.rows = []
        this.coefficients = null
        this.errors = []
        this.error = null
        this.lastAt = -Infinity
        this.usable = false
        this.point = null
        this.clearWindow()
        this.cancelIntent()
    }
    invalidate(): void {
        if (this.phase !== 'off') this.enable(true)
    }
    private clearWindow(): void {
        this.window = []
        this.since = null
        this.progress = 0
    }
    private cancelIntent(): void {
        this.validSince = null
        this.intentSince = null
        this.intent = ''
    }
    private predict(point: EyePoint): EyePoint | null {
        if (!this.coefficients) return null
        const r = [point.x, point.y, 1]
        return {
            x: r.reduce((s, v, i) => s + v * this.coefficients!.x[i], 0),
            y: r.reduce((s, v, i) => s + v * this.coefficients!.y[i], 0),
        }
    }
    sample(face: FaceReading | null, at: number): void {
        if (
            this.phase === 'off' ||
            this.phase === 'failed' ||
            !Number.isFinite(at) ||
            at <= this.lastAt
        )
            return
        if (at - this.lastAt > 250) {
            this.clearWindow()
            this.cancelIntent()
        }
        this.lastAt = at
        const feature = eyeFeatures(face)
        if (feature && !this.origin) this.origin = { ...face!.orientation! }
        const pose = face?.orientation
        this.usable =
            !!feature &&
            !!pose &&
            !!this.origin &&
            Math.abs(pose.yaw - this.origin.yaw) <= Math.PI / 18 &&
            Math.abs(pose.pitch - this.origin.pitch) <= Math.PI / 18
        if (!this.usable || !feature) {
            this.clearWindow()
            this.point = null
            this.cancelIntent()
            return
        }
        if (this.phase === 'ready') {
            this.point = this.predict(feature)
            return
        }
        const first = this.window[0]
        if (
            first &&
            Math.hypot(feature.x - first.x, feature.y - first.y) > 0.035
        )
            this.clearWindow()
        this.since ??= at
        this.window.push(feature)
        this.progress = Math.min(1, (at - this.since) / 1000)
        if (this.progress < 1 || this.window.length < 12) return
        const mean = {
            x: this.window.reduce((s, p) => s + p.x, 0) / this.window.length,
            y: this.window.reduce((s, p) => s + p.y, 0) / this.window.length,
        }
        if (this.phase === 'calibrating') {
            this.rows.push([mean.x, mean.y, 1])
            this.index++
            if (this.index === EYE_TARGETS.length) {
                const x = solve(
                        this.rows,
                        EYE_TARGETS.map((p) => p.x),
                    ),
                    y = solve(
                        this.rows,
                        EYE_TARGETS.map((p) => p.y),
                    )
                if (!x || !y) {
                    this.phase = 'failed'
                    this.clearWindow()
                    return
                }
                this.coefficients = { x, y }
                this.phase = 'validating'
                this.index = 0
            }
        } else {
            const estimate = this.predict(mean)!,
                target = EYE_VALIDATION[this.index]
            this.errors.push(
                Math.hypot(estimate.x - target.x, estimate.y - target.y),
            )
            this.index++
            if (this.index === EYE_VALIDATION.length) {
                this.error =
                    this.errors.reduce((s, e) => s + e, 0) / this.errors.length
                this.phase =
                    this.error <= 0.18 && Math.max(...this.errors) <= 0.3
                        ? 'ready'
                        : 'failed'
                this.index = 0
                this.cancelIntent()
            }
        }
        this.clearWindow()
    }
    /** Absolute bounded correction. The caller applies its delta once, separately from head gesture signals. */
    update(
        at: number,
        dt: number,
        active: boolean,
        allowed: (point: EyePoint) => boolean,
    ): { yaw: number; pitch: number } {
        if (at - this.lastAt > 250) this.usable = false
        let yaw = 0,
            pitch = 0
        const p = this.point
        const valid =
            active &&
            this.phase === 'ready' &&
            this.usable &&
            at - this.lastAt <= 250 &&
            p &&
            p.x >= 0 &&
            p.x <= 1 &&
            p.y >= 0 &&
            p.y <= 1 &&
            allowed(p)
        if (valid && p) {
            this.validSince ??= at
            const x = p.x * 2 - 1,
                y = 1 - p.y * 2
            const sx = Math.abs(x) > 0.15 ? Math.sign(x) : 0,
                sy = Math.abs(y) > 0.15 ? Math.sign(y) : 0
            const intent = `${sx}:${sy}`
            if (intent !== this.intent) {
                this.intent = intent
                this.intentSince = at
            }
            if (
                at - this.validSince >= 400 &&
                this.intentSince !== null &&
                at - this.intentSince >= 300
            ) {
                const shape = (v: number) =>
                    (Math.sign(v) * Math.max(0, Math.abs(v) - 0.15)) / 0.85
                yaw = (shape(x) * 6 * Math.PI) / 180
                pitch = (shape(y) * 4 * Math.PI) / 180
            }
        } else this.cancelIntent()
        const k = 1 - Math.exp(-8 * Math.max(0, Math.min(dt, 0.1)))
        this.offset = {
            yaw: this.offset.yaw + (yaw - this.offset.yaw) * k,
            pitch: this.offset.pitch + (pitch - this.offset.pitch) * k,
        }
        return { ...this.offset }
    }
}
