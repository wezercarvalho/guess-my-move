import {
    type BoardPlacement,
    type ChordEvaluation,
    type ChordId,
    type FingerDebug,
    type FingerPress,
    type HandInput,
    type ScreenPoint,
    ChordStability,
    DEFAULT_PLACEMENT,
    FingerTracker,
    HandRoleAssigner,
    StrumDetector,
    chordById,
    evaluateChord,
    planStrum,
    soundingStrings,
    strumZone,
} from '@guess-my-move/guitar'

import { drawHands } from '../round/handOverlay.js'
import { type CreateHandTracker, type HandTracker, type TrackedHand } from '../tracker/handTracker.js'
import { type AudioPlayer, type AudioStatus } from './audioPlayer.js'
import { drawBoardOverlay } from './boardOverlay.js'

export type GuitarTrackerStatus = 'idle' | 'loading' | 'ready' | 'error'

/** Dependências do controlador; em testes, o rastreador, o áudio, o relógio e as teclas são simulados. */
export interface GuitarEnv {
    createTracker: CreateHandTracker
    createAudio: () => AudioPlayer
    requestFrame: (callback: () => void) => number
    cancelFrame: (handle: number) => void
    /** Relógio monotônico em ms. */
    now: () => number
    /** Onde ouvir o teclado (a janela, por padrão). */
    keys: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>
}

/** Elementos da tela, entregues na montagem (nunca durante a renderização). */
export interface GuitarSurfaces {
    getVideo: () => HTMLVideoElement | null
    getOverlay: () => HTMLCanvasElement | null
}

export interface StrumRecord {
    direction: 'down' | 'up'
    force: number
    /** `hand`: a mão que bate; `key`: teclado ou clique. */
    source: 'hand' | 'key'
    tMs: number
    /** O som realmente foi agendado (o áudio estava liberado). */
    heard: boolean
}

export interface GuitarDebug {
    fingers: readonly FingerDebug[]
    /** Quadros de câmera processados por segundo, ou 0 sem medição. */
    fps: number
    delegate: string | null
    latency: { base: number | null; output: number | null }
    /** Velocidade vertical da mão que bate (tamanhos de mão por segundo, com sinal). */
    strumSpeed: number
}

export interface GuitarSnapshot {
    chord: ChordId
    placement: BoardPlacement
    leftHanded: boolean
    ignoreExtraFingers: boolean
    cameraActive: boolean
    trackerStatus: GuitarTrackerStatus
    trackerFailure: string | null
    handsVisible: number
    fretVisible: boolean
    strumVisible: boolean
    presses: readonly FingerPress[]
    evaluation: ChordEvaluation
    /** O acorde está certo e sustentado. */
    stable: boolean
    /** Acordes já tocados certos, na ordem em que foram concluídos. */
    completed: readonly ChordId[]
    lastStrum: StrumRecord | null
    audioStatus: AudioStatus
    debug: GuitarDebug
}

/** Sem quadro novo da câmera por este tempo, as mãos contam como perdidas. */
const STALE_HAND_MS = 500
const KEY_FORCE = 0.8
const CONTROL_KEYS = new Set([' ', 'ArrowUp', 'ArrowDown'])
const PALM = [0, 5, 9, 13, 17]
const FPS_WINDOW = 15

const messageOf = (error: unknown) =>
    error instanceof Error && error.message ? error.message : 'Falha desconhecida.'

/** Passa um ponto da câmera (x crescendo para a direita da imagem original) para a tela espelhada. */
const mirror = (point: { x: number; y: number }): ScreenPoint => ({ x: 1 - point.x, y: point.y })

/**
 * Orquestra câmera, rastreador de duas mãos, reconhecimento do acorde, batida e som, sem
 * depender do React. A cada quadro novo da câmera: separa as mãos pelo lado da tela, traduz
 * os dedos em corda e casa, confere o acorde alvo e, se a outra mão bate, toca o que a mão
 * forma. O teclado toca sem câmera. Nada da câmera é gravado nem enviado.
 */
export class GuitarController {
    private readonly env: GuitarEnv
    private readonly audio: AudioPlayer
    private readonly listeners = new Set<() => void>()
    private readonly roles = new HandRoleAssigner()
    private readonly fingers = new FingerTracker()
    private readonly stability = new ChordStability()
    private readonly strumDetector = new StrumDetector()
    private surfaces: GuitarSurfaces = { getVideo: () => null, getOverlay: () => null }
    private attached = false
    private cameraActive = false
    private chord: ChordId = 'Em'
    private leftHanded = false
    private placement: BoardPlacement = DEFAULT_PLACEMENT
    private ignoreExtraFingers = false
    private tracker: HandTracker | null = null
    private trackerStatus: GuitarTrackerStatus = 'idle'
    private trackerFailure: string | null = null
    private loadToken = 0
    private hands: TrackedHand[] = []
    private lastHandAt = 0
    private fretHand: HandInput | null = null
    private strumHand: HandInput | null = null
    private presses: readonly FingerPress[] = []
    private evaluation: ChordEvaluation
    private stable = false
    private completed: ChordId[] = []
    private lastStrum: StrumRecord | null = null
    private frameTimes: number[] = []
    private lastVideoTime = -1
    private cameraFrameVideo: HTMLVideoElement | null = null
    private cameraFrameHandle: number | null = null
    private cameraFramePending = false
    private loop: number | null = null
    private unsubscribeAudio: (() => void) | null = null
    private snapshot: GuitarSnapshot

    constructor(env: GuitarEnv) {
        this.env = env
        this.audio = env.createAudio()
        this.evaluation = evaluateChord(chordById(this.chord), [])
        this.snapshot = this.buildSnapshot()
    }

    readonly subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener)
        return () => {
            this.listeners.delete(listener)
        }
    }

    readonly getSnapshot = (): GuitarSnapshot => this.snapshot

    /** Liga o controlador (montagem da tela): escuta o teclado, o áudio e começa o laço. */
    attach(surfaces: GuitarSurfaces): void {
        this.surfaces = surfaces
        this.attached = true
        this.env.keys.addEventListener('keydown', this.onKeyDown as EventListener)
        this.unsubscribeAudio = this.audio.subscribe(() => {
            this.emit()
        })
        this.ensureLoop()
        this.sync()
    }

    /** Desliga: encerra o laço, libera o rastreador e o áudio e solta o teclado. */
    detach(): void {
        this.attached = false
        this.loadToken++
        this.env.keys.removeEventListener('keydown', this.onKeyDown as EventListener)
        this.unsubscribeAudio?.()
        this.unsubscribeAudio = null
        this.stopLoop()
        this.tracker?.close()
        this.tracker = null
        this.trackerStatus = 'idle'
        this.audio.dispose()
        this.snapshot = this.buildSnapshot()
    }

    setCamera(active: boolean): void {
        this.cameraActive = active
        if (!active) this.dropHands()
        // ativar a câmera vem de um clique: o navegador ainda aceita liberar o áudio agora, e
        // a batida pela mão (que não é um gesto do usuário) só soa se o áudio já estiver liberado
        else void this.audio.unlock()
        this.sync()
    }

    /** Libera o áudio; chame de um clique ou tecla (gestos do usuário). */
    unlockAudio(): void {
        void this.audio.unlock()
    }

    setChord(id: ChordId): void {
        if (id === this.chord) return
        this.chord = id
        this.stability.reset()
        this.stable = false
        this.reevaluate()
        this.emit()
    }

    setLeftHanded(value: boolean): void {
        this.leftHanded = value
        this.placement = this.withHandedness(this.placement)
        this.resetRecognition()
        this.emit()
    }

    /** Move ou redimensiona o braço (a opção canhoto é mantida). */
    setPlacement(placement: BoardPlacement): void {
        this.placement = this.withHandedness(placement)
        this.fingers.reset()
        this.stability.reset()
        this.stable = false
        this.presses = []
        this.reevaluate()
        this.emit()
    }

    setIgnoreExtraFingers(value: boolean): void {
        this.ignoreExtraFingers = value
        this.reevaluate()
        this.emit()
    }

    /** Batida pelo teclado ou pelo clique. Também tenta liberar o áudio (é um gesto do usuário). */
    strum(direction: 'down' | 'up', force: number = KEY_FORCE): void {
        this.trigger(direction, force, 'key')
    }

    private withHandedness(placement: BoardPlacement): BoardPlacement {
        const { x, y, width, height } = placement
        return this.leftHanded ? { x, y, width, height, leftHanded: true } : { x, y, width, height }
    }

    private resetRecognition(): void {
        this.roles.reset()
        this.fingers.reset()
        this.strumDetector.reset()
        this.stability.reset()
        this.stable = false
        this.fretHand = null
        this.strumHand = null
        this.presses = []
        this.reevaluate()
    }

    private reevaluate(): void {
        this.evaluation = evaluateChord(chordById(this.chord), this.presses, {
            ignoreExtraFingers: this.ignoreExtraFingers,
        })
    }

    private sync(): void {
        if (this.attached && this.cameraActive && this.trackerStatus === 'idle') this.loadTracker()
        if (!this.cameraActive && this.tracker) this.releaseTracker()
        this.emit()
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
                this.trackerStatus = 'ready'
                this.watchCameraFrames()
                this.emit()
            },
            (error: unknown) => {
                if (token !== this.loadToken || !this.attached) return
                this.trackerStatus = 'error'
                this.trackerFailure = messageOf(error)
                this.emit()
            },
        )
    }

    private releaseTracker(): void {
        this.loadToken++
        this.unwatchCameraFrames()
        this.tracker?.close()
        this.tracker = null
        this.trackerStatus = 'idle'
    }

    private dropHands(): void {
        this.hands = []
        this.fretHand = null
        this.strumHand = null
        this.frameTimes = []
        this.strumDetector.lost()
        this.applyFretHand(this.env.now())
        this.drawOverlay()
    }

    private ensureLoop(): void {
        if (this.loop !== null || !this.attached) return
        this.loop = this.env.requestFrame(this.frame)
    }

    private stopLoop(): void {
        if (this.loop !== null) this.env.cancelFrame(this.loop)
        this.loop = null
        this.unwatchCameraFrames()
    }

    private readonly frame = (): void => {
        this.loop = null
        if (!this.attached) return
        const now = this.env.now()
        const changed = this.readHands(now)
        this.drawOverlay()
        if (changed) this.emit()
        this.loop = this.env.requestFrame(this.frame)
    }

    /**
     * Lê as mãos quando a câmera entregou um quadro novo; sem quadros por um tempo, as mãos
     * se perdem. Devolve `true` quando o estado mudou e a tela deve ser avisada.
     */
    private readHands(now: number): boolean {
        const { tracker } = this
        const video = this.surfaces.getVideo()
        if (!tracker || !video || !this.cameraActive) return false
        if (video.readyState >= 2 && video.videoWidth > 0 && this.takeNewCameraFrame(video)) {
            let tracked: TrackedHand[]
            try {
                tracked = tracker.detectAll
                    ? tracker.detectAll(video, now)
                    : (() => {
                          const single = tracker.detect(video, now)
                          return single ? [single] : []
                      })()
            } catch (error) {
                this.releaseTracker()
                this.trackerStatus = 'error'
                this.trackerFailure = messageOf(error)
                this.dropHands()
                return true
            }
            this.lastHandAt = now
            this.hands = tracked
            this.noteFrame(now)
            this.process(tracked, now, video.videoWidth / video.videoHeight)
            return true
        }
        if (this.hands.length > 0 && now - this.lastHandAt > STALE_HAND_MS) {
            this.dropHands()
            return true
        }
        return false
    }

    /** Separa as mãos, lê os dedos, confere o acorde e detecta a batida. */
    private process(tracked: readonly TrackedHand[], now: number, aspect: number): void {
        const inputs: HandInput[] = tracked.map((hand) => ({
            landmarks: hand.landmarks.map(mirror),
        }))
        const roles = this.roles.assign(inputs, this.placement)
        this.fretHand = roles.fretting
        this.strumHand = roles.strumming
        this.applyFretHand(now)
        if (roles.strumming) {
            const sample = this.strumSample(roles.strumming, now, aspect)
            const event = sample
                ? this.strumDetector.update(sample, strumZone(this.placement))
                : null
            if (event) this.trigger(event.direction, event.force, 'hand')
        } else {
            this.strumDetector.lost()
        }
    }

    private applyFretHand(now: number): void {
        this.presses = this.fingers.update(now, this.fretHand?.landmarks ?? null, this.placement)
        this.reevaluate()
        this.stable = this.stability.update(this.evaluation.complete, now)
    }

    private strumSample(hand: HandInput, now: number, aspect: number) {
        const points = PALM.map((index) => hand.landmarks[index]).filter(
            (point): point is ScreenPoint => point !== undefined,
        )
        const wrist = hand.landmarks[0]
        const middle = hand.landmarks[9]
        if (points.length === 0 || !wrist || !middle) return null
        const x = points.reduce((sum, point) => sum + point.x, 0) / points.length
        const y = points.reduce((sum, point) => sum + point.y, 0) / points.length
        const handSize = Math.hypot((wrist.x - middle.x) * aspect, wrist.y - middle.y)
        return { tMs: now, x, y, handSize }
    }

    private noteFrame(now: number): void {
        this.frameTimes.push(now)
        if (this.frameTimes.length > FPS_WINDOW) this.frameTimes.shift()
    }

    private fps(): number {
        const first = this.frameTimes[0]
        const last = this.frameTimes[this.frameTimes.length - 1]
        if (first === undefined || last === undefined || last <= first) return 0
        return ((this.frameTimes.length - 1) * 1000) / (last - first)
    }

    /** Toca a batida. Sem mão do braço visível, a tecla toca o acorde alvo como está escrito. */
    private trigger(direction: 'down' | 'up', force: number, source: 'hand' | 'key'): void {
        const play = (): void => {
            if (!this.attached) return
            const fromHand = this.fretHand !== null || source === 'hand'
            const sounding = fromHand
                ? this.evaluation.sounding
                : soundingStrings(chordById(this.chord))
            const heard = this.audio.play(planStrum(sounding, direction, force))
            this.lastStrum = { direction, force, source, tMs: this.env.now(), heard }
            if (source === 'hand' && this.stable && this.evaluation.complete && heard) {
                if (!this.completed.includes(this.chord)) this.completed = [...this.completed, this.chord]
            }
            this.emit()
        }
        if (this.audio.status === 'running') {
            play()
        } else if (source === 'key') {
            void this.audio.unlock().then(play)
        } else {
            // a mão não é um gesto do usuário: o navegador não deixa liberar o áudio por ela
            play()
        }
    }

    private drawOverlay(): void {
        const overlay = this.surfaces.getOverlay()
        const video = this.surfaces.getVideo()
        if (!overlay || !video) return
        drawHands(
            overlay,
            video,
            this.cameraActive ? this.hands.map((hand) => hand.landmarks) : [],
        )
        if (!this.cameraActive) return
        drawBoardOverlay(overlay, video, {
            placement: this.placement,
            target: chordById(this.chord),
            evaluation: this.evaluation,
            fingers: this.fingers.debug(),
        })
    }

    private takeNewCameraFrame(video: HTMLVideoElement): boolean {
        if (this.cameraFrameVideo === video) {
            if (!this.cameraFramePending) return false
            this.cameraFramePending = false
            return true
        }
        if (video.currentTime === this.lastVideoTime) return false
        this.lastVideoTime = video.currentTime
        return true
    }

    /** Pede ao vídeo que avise cada quadro NOVO da câmera, quando o navegador oferece. */
    private watchCameraFrames(): void {
        const video = this.surfaces.getVideo()
        this.unwatchCameraFrames()
        if (!video || typeof video.requestVideoFrameCallback !== 'function') return
        this.cameraFrameVideo = video
        const arm = (): void => {
            this.cameraFrameHandle = video.requestVideoFrameCallback(() => {
                this.cameraFramePending = true
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
        this.lastVideoTime = -1
    }

    private readonly onKeyDown = (event: KeyboardEvent): void => {
        if (!CONTROL_KEYS.has(event.key) || event.repeat) return
        const target = event.target
        if (
            target instanceof HTMLElement &&
            ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'A'].includes(target.tagName)
        ) {
            return
        }
        event.preventDefault()
        this.strum(event.key === 'ArrowUp' ? 'up' : 'down')
    }

    private emit(): void {
        this.snapshot = this.buildSnapshot()
        for (const listener of [...this.listeners]) listener()
    }

    private buildSnapshot(): GuitarSnapshot {
        return {
            chord: this.chord,
            placement: this.placement,
            leftHanded: this.leftHanded,
            ignoreExtraFingers: this.ignoreExtraFingers,
            cameraActive: this.cameraActive,
            trackerStatus: this.trackerStatus,
            trackerFailure: this.trackerFailure,
            handsVisible: this.hands.length,
            fretVisible: this.fretHand !== null,
            strumVisible: this.strumHand !== null,
            presses: this.presses,
            evaluation: this.evaluation,
            stable: this.stable,
            completed: this.completed,
            lastStrum: this.lastStrum,
            audioStatus: this.audio.status,
            debug: {
                fingers: this.fingers.debug(),
                fps: this.fps(),
                delegate: this.tracker?.delegate ?? null,
                latency: this.audio.latency(),
                strumSpeed: this.strumDetector.debug().speed,
            },
        }
    }
}
