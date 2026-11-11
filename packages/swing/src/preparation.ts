import type { FaceReading, HeadOrientation } from './headLook.js'
import { isFist, isOpenPalm, type HandPoint } from './pose.js'

export type ControlMode = 'face' | 'hands' | 'keyboard'
export type PreparationStep =
    | 'face'
    | 'left'
    | 'center'
    | 'right'
    | 'up'
    | 'down'
    | 'hands'
    | 'confirm'
    | 'release'
    | 'ready'
export interface PreparationView {
    step: PreparationStep
    progress: number
    mode: ControlMode
    handCount: 1 | 2
    ready: boolean
    message: string
}
const rad = Math.PI / 180
const directions = [
    'left',
    'center',
    'right',
    'center',
    'up',
    'center',
    'down',
    'center',
] as const
export function pointsVisible(
    points: readonly HandPoint[],
    minimum: number,
): boolean {
    return (
        points.length >= minimum &&
        points.every(
            (p) =>
                Number.isFinite(p.x) &&
                Number.isFinite(p.y) &&
                (p.z === undefined || Number.isFinite(p.z)) &&
                p.x >= 0 &&
                p.x <= 1 &&
                p.y >= 0 &&
                p.y <= 1,
        )
    )
}
export function faceUsable(face: FaceReading | null): boolean {
    if (
        !face?.orientation ||
        !Number.isFinite(face.orientation.yaw) ||
        !Number.isFinite(face.orientation.pitch) ||
        !pointsVisible(face.landmarks, 2)
    )
        return false
    const xs = face.landmarks.map((p) => p.x),
        ys = face.landmarks.map((p) => p.y)
    const x = (Math.min(...xs) + Math.max(...xs)) / 2
    const y = (Math.min(...ys) + Math.max(...ys)) / 2
    return x >= 0.25 && x <= 0.75 && y >= 0.25 && y <= 0.75
}
/** Up is vertical in the camera image, independent of handedness/mirroring. */
export function isPositive(points: readonly HandPoint[]): boolean {
    if (!pointsVisible(points, 21) || !isFist(points)) return false
    const wrist = points[0],
        base = points[9],
        thumbBase = points[2],
        joint = points[3],
        tip = points[4]
    const scale = Math.hypot(wrist.x - base.x, wrist.y - base.y)
    const rise = thumbBase.y - tip.y
    return (
        scale > 0.01 &&
        rise >= scale * 0.9 &&
        rise > Math.abs(tip.x - thumbBase.x) * 1.4 &&
        tip.y < joint.y &&
        joint.y < thumbBase.y
    )
}
const messages: Record<PreparationStep, string> = {
    face: 'Olhe para o centro da cidade e mantenha a cabeça parada por 1 segundo.',
    left: '← Vire a cabeça para a sua esquerda.',
    right: 'Vire a cabeça para a sua direita. →',
    up: '↑ Incline a cabeça para cima.',
    down: '↓ Incline a cabeça para baixo.',
    center: 'Volte a olhar para o centro da cidade e mantenha a cabeça parada.',
    hands: 'Mostre a palma aberta à câmera, mantendo o olhar na cidade.',
    confirm: 'Faça positivo: polegar para cima, demais dedos fechados.',
    release: 'Positivo confirmado. Abra a palma para liberar os controles.',
    ready: 'Controles preparados.',
}
/** Pure machine. Calls use camera timestamps, never render-frame counts. */
export class SwingPreparation {
    private mode: ControlMode = 'face'
    private handCount: 1 | 2 = 1
    private step: PreparationStep = 'face'
    private progress = 0
    private lastAt = -Infinity
    private since: number | null = null
    private count = 0
    private neutral: HeadOrientation | null = null
    private oriented = false
    private directionIndex = 0
    private signs = { yaw: 1, pitch: 1 }
    private candidateSign = 0
    private firstYaw = 0
    private firstPitch = 0
    private armed = false
    private live = false
    private reason: string | null = null
    get view(): PreparationView {
        return {
            step: this.step,
            progress: this.progress,
            mode: this.mode,
            handCount: this.handCount,
            ready: this.step === 'ready',
            message:
                this.reason ??
                (this.mode === 'keyboard' && this.step === 'confirm'
                    ? 'Clique em Iniciar com teclado.'
                    : this.step === 'hands' && this.handCount === 2
                      ? 'Mostre as duas palmas abertas ao mesmo tempo.'
                      : messages[this.step]),
        }
    }
    setLive(live: boolean): void {
        this.live = live
    }
    configure(mode: ControlMode, handCount: 1 | 2): void {
        this.mode = mode
        this.handCount = handCount
        this.reset()
    }
    reset(): void {
        this.step =
            this.mode === 'keyboard'
                ? 'confirm'
                : this.mode === 'face'
                  ? 'face'
                  : 'hands'
        this.neutral = null
        this.oriented = false
        this.directionIndex = 0
        this.signs = { yaw: 1, pitch: 1 }
        this.armed = false
        this.live = false
        this.reason = null
        this.lastAt = -Infinity
        this.clearWindow()
    }
    restart(): void {
        this.live = false
        this.armed = false
        this.clearWindow()
        this.step =
            this.mode === 'face' && !this.oriented
                ? 'face'
                : this.mode === 'keyboard'
                  ? 'confirm'
                  : 'hands'
    }
    confirmKeyboard(): void {
        if (this.mode === 'keyboard' && this.step === 'confirm')
            this.step = 'ready'
    }
    correct(orientation: HeadOrientation): HeadOrientation {
        return {
            yaw: orientation.yaw * this.signs.yaw,
            pitch: orientation.pitch * this.signs.pitch,
        }
    }
    expire(at: number): void {
        if (this.mode === 'keyboard' || this.live || at - this.lastAt <= 250)
            return
        this.invalidate()
        this.reason =
            'Imagem sem atualização. Reposicione-se ou reinicie a câmera.'
    }
    private clearWindow(): void {
        this.since = null
        this.count = 0
        this.progress = 0
    }
    private hold(
        valid: boolean,
        at: number,
        duration: number,
        minimum = 2,
    ): boolean {
        if (!valid) {
            this.clearWindow()
            return false
        }
        this.since ??= at
        this.count++
        this.progress = Math.min(1, (at - this.since) / duration)
        return this.progress >= 1 && this.count >= minimum
    }
    private next(step: PreparationStep): void {
        this.step = step
        this.candidateSign = 0
        this.clearWindow()
        this.reason = null
    }
    private invalidate(): void {
        if (this.mode === 'face') {
            this.neutral = null
            this.oriented = false
            this.directionIndex = 0
            this.next('face')
        } else this.next('hands')
        this.armed = false
    }
    sample(input: {
        at: number
        face: FaceReading | null
        hands: readonly (readonly HandPoint[])[]
    }): void {
        const { at, face, hands } = input
        if (
            !Number.isFinite(at) ||
            at <= this.lastAt ||
            this.mode === 'keyboard' ||
            this.live
        )
            return
        if (at - this.lastAt > 250) this.clearWindow()
        this.lastAt = at
        this.reason = null
        if (this.mode === 'face' && !faceUsable(face)) {
            this.invalidate()
            this.reason = face?.landmarks.length
                ? 'Enquadre o rosto inteiro e olhe para a câmera.'
                : 'Rosto não encontrado. Posicione-se no guia.'
            return
        }
        const pose = face?.orientation
        if (this.step === 'face' && pose) {
            if (
                !this.neutral ||
                Math.abs(pose.yaw - this.neutral.yaw) > 2 * rad ||
                Math.abs(pose.pitch - this.neutral.pitch) > 2 * rad
            ) {
                this.neutral = { ...pose }
                this.clearWindow()
            }
            if (this.hold(true, at, 1000, 12)) {
                this.directionIndex = 0
                this.next('left')
            }
            return
        }
        if (
            directions.includes(this.step as (typeof directions)[number]) &&
            pose &&
            this.neutral
        ) {
            const yaw = pose.yaw - this.neutral.yaw,
                pitch = pose.pitch - this.neutral.pitch
            if (this.step === 'center') {
                if (
                    this.hold(
                        Math.abs(yaw) <= 5 * rad && Math.abs(pitch) <= 5 * rad,
                        at,
                        400,
                    )
                )
                    this.advanceDirection()
                return
            }
            const horizontal = this.step === 'left' || this.step === 'right'
            const v = horizontal ? yaw : pitch,
                cross = horizontal ? pitch : yaw
            const opposite =
                this.step === 'right'
                    ? this.firstYaw
                    : this.step === 'down'
                      ? this.firstPitch
                      : 0
            if (Math.sign(v) !== this.candidateSign) {
                this.clearWindow()
                this.candidateSign = Math.sign(v)
            }
            const valid =
                Math.abs(v) >= 8 * rad &&
                Math.abs(cross) < 12 * rad &&
                (opposite === 0 || Math.sign(v) !== opposite)
            if (
                !valid &&
                opposite !== 0 &&
                Math.sign(v) === opposite &&
                Math.abs(v) >= 8 * rad
            )
                this.reason =
                    'Sentido inconsistente. Volte ao centro e tente o sentido indicado.'
            if (this.hold(valid, at, 400)) {
                if (this.step === 'left') {
                    this.firstYaw = Math.sign(v)
                    this.signs.yaw = -Math.sign(v)
                }
                if (this.step === 'up') {
                    this.firstPitch = Math.sign(v)
                    this.signs.pitch = Math.sign(v)
                }
                this.advanceDirection()
            }
            return
        }
        const visible = hands.filter((h) => pointsVisible(h, 21))
        const enough = visible.length >= this.handCount
        const open =
            enough && visible.filter(isOpenPalm).length >= this.handCount
        const positive = visible.some(isPositive)
        if (this.step === 'hands') {
            if (this.hold(open, at, 500)) {
                this.armed = false
                this.next('confirm')
            }
        } else if (this.step === 'confirm') {
            if (!enough) {
                this.next('hands')
                this.armed = false
                return
            }
            if (!positive) this.armed = true
            if (this.hold(this.armed && positive, at, 800)) this.next('release')
        } else if (this.step === 'release') {
            if (!enough) {
                this.next('hands')
                this.armed = false
                return
            }
            if (this.hold(open, at, 200)) this.next('ready')
        } else if (this.step === 'ready' && !enough) {
            this.next('hands')
            this.armed = false
        }
    }
    private advanceDirection(): void {
        this.directionIndex++
        if (this.directionIndex === directions.length) this.oriented = true
        this.next(directions[this.directionIndex] ?? 'hands')
    }
}
