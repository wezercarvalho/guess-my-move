import {
    type City,
    type SwingCue,
    type SwingInput,
    type SwingWorld,
    type TriggerGesture,
    type WebSide,
    type WebTrigger,
    DEFAULT_SWING,
    createCityIndex,
    createSwingWorld,
    createWebTrigger,
    handSide,
    steerFromHand,
    swingCue,
    webSignal,
} from '@guess-my-move/swing'

import { drawHands } from '../round/handOverlay.js'
import { type CreateHandTracker, type HandTracker, type TrackedHand } from '../tracker/handTracker.js'
import { type CreateSwingRenderer, type SwingRenderer } from './cityRenderer.js'
import { drawReticle, reticlePlacement } from './reticle.js'
import { drawSpeedLines } from './speedLines.js'

export type SwingTrackerStatus = 'idle' | 'loading' | 'ready' | 'error'

/** `loading`: baixando a cidade; `playing`: jogo rodando; `error`: cidade ou 3D indisponível. */
export type SwingPhase = 'loading' | 'playing' | 'error'

export interface SwingHud {
    speedKmh: number
    /** Altura do olho acima do chão, em metros. */
    altitude: number
    webs: number
    distance: number
    webAttached: boolean
    /** Mão que lançou a teia presa (-1 esquerda, 0 centro, 1 direita); `null` sem teia. */
    webSide: WebSide | null
    /** O primeiro gesto de teia já aconteceu; antes disso o jogador espera no início. */
    started: boolean
}

/** Dependências do controlador; em testes, a cidade, o 3D, o relógio e as teclas são simulados. */
export interface SwingEnv {
    createTracker: CreateHandTracker
    loadCity: () => Promise<City>
    createRenderer: CreateSwingRenderer
    requestFrame: (callback: () => void) => number
    cancelFrame: (handle: number) => void
    /** Relógio monotônico em ms. */
    now: () => number
    /** Onde ouvir o teclado (a janela, por padrão). */
    keys: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>
}

/** Elementos da tela, entregues na montagem (nunca durante a renderização). */
export interface SwingSurfaces {
    getVideo: () => HTMLVideoElement | null
    getOverlay: () => HTMLCanvasElement | null
    getScene: () => HTMLCanvasElement | null
    getEffects: () => HTMLCanvasElement | null
}

export interface SwingSnapshot {
    phase: SwingPhase
    failure: string | null
    trackerStatus: SwingTrackerStatus
    trackerFailure: string | null
    handVisible: boolean
    /** O gesto de teia está sendo segurado (não conta a tecla). */
    gestureHeld: boolean
    /** Qual mão está segurando o gesto de teia. */
    held: { left: boolean; right: boolean }
    /** Quantas mãos a câmera vê agora. */
    handsVisible: number
    /** O próximo gesto a fazer, para as dicas da tela. */
    cue: SwingCue
    /** Resultado do último lançamento: prendeu, errou, ou `null` antes do primeiro. */
    lastThrow: 'hit' | 'miss' | null
    hud: SwingHud
    attribution: string
}

const PUBLISH_INTERVAL_MS = 100
/** Sem quadro novo da câmera por este tempo, a mão conta como perdida. */
const STALE_HAND_MS = 500

const messageOf = (error: unknown) =>
    error instanceof Error && error.message ? error.message : 'Falha desconhecida.'

const EMPTY_HUD: SwingHud = { speedKmh: 0, altitude: 0, webs: 0, distance: 0, webAttached: false, webSide: null, started: false }

/**
 * Orquestra o mundo do jogo, o desenho 3D, a câmera com o detector de mão e o teclado,
 * sem depender do React. O laço roda por quadro de tela: lê a mão quando há quadro novo da
 * câmera, converte em teia e direção, avança a simulação e desenha. O teclado joga
 * sozinho, sem câmera. Nada da câmera é gravado nem enviado.
 */
export class SwingController {
    private readonly env: SwingEnv
    private readonly listeners = new Set<() => void>()
    private readonly triggers: { left: WebTrigger; right: WebTrigger } = {
        left: createWebTrigger(),
        right: createWebTrigger(),
    }
    private readonly keys = new Set<string>()
    private surfaces: SwingSurfaces = {
        getVideo: () => null,
        getOverlay: () => null,
        getScene: () => null,
        getEffects: () => null,
    }
    private attached = false
    private attachToken = 0
    private cameraActive = false
    private phase: SwingPhase = 'loading'
    private failure: string | null = null
    private city: City | null = null
    private world: SwingWorld | null = null
    private renderer: SwingRenderer | null = null
    private size = { width: 0, height: 0 }
    private tracker: HandTracker | null = null
    private trackerStatus: SwingTrackerStatus = 'idle'
    private trackerFailure: string | null = null
    private loadToken = 0
    private hand: TrackedHand | null = null
    private hands: TrackedHand[] = []
    /** Mão que está fazendo o gesto de teia, por posição na lista `hands`. */
    private webHandIndexes = new Set<number>()
    private lastHandAt = 0
    private held = { left: false, right: false }
    private readonly sideKeys = { left: 'z', right: 'x' }
    private lastThrow: 'hit' | 'miss' | null = null
    private counted = { webs: 0, misses: 0 }
    private lastVideoTime = -1
    private cameraFrameVideo: HTMLVideoElement | null = null
    private cameraFrameHandle: number | null = null
    private cameraFramePending = false
    private loop: number | null = null
    private lastNow: number | null = null
    private lastEmitAt = 0
    private snapshot: SwingSnapshot

    constructor(env: SwingEnv) {
        this.env = env
        this.snapshot = this.buildSnapshot()
    }

    readonly subscribe = (listener: () => void): (() => void) => {
        this.listeners.add(listener)
        return () => {
            this.listeners.delete(listener)
        }
    }

    readonly getSnapshot = (): SwingSnapshot => this.snapshot

    /** Liga o controlador (montagem da tela): carrega a cidade, cria o 3D e escuta o teclado. */
    attach(surfaces: SwingSurfaces): void {
        this.surfaces = surfaces
        this.attached = true
        const token = ++this.attachToken
        this.env.keys.addEventListener('keydown', this.onKeyDown as EventListener)
        this.env.keys.addEventListener('keyup', this.onKeyUp as EventListener)
        this.phase = 'loading'
        this.failure = null
        this.env.loadCity().then(
            (city) => {
                if (token !== this.attachToken || !this.attached) return
                this.start(city)
            },
            (error: unknown) => {
                if (token !== this.attachToken || !this.attached) return
                this.fail(`Não foi possível carregar a cidade: ${messageOf(error)}`)
            },
        )
        this.sync()
    }

    /** Desliga: encerra o laço, libera o 3D e o detector e solta o teclado. */
    detach(): void {
        this.attached = false
        this.attachToken++
        this.loadToken++
        this.env.keys.removeEventListener('keydown', this.onKeyDown as EventListener)
        this.env.keys.removeEventListener('keyup', this.onKeyUp as EventListener)
        this.keys.clear()
        this.stopLoop()
        this.renderer?.dispose()
        this.renderer = null
        this.world = null
        this.tracker?.close()
        this.tracker = null
        this.trackerStatus = 'idle'
        this.hand = null
        this.snapshot = this.buildSnapshot()
    }

    setCamera(active: boolean): void {
        this.cameraActive = active
        if (!active) this.dropHand()
        this.sync()
    }

    /** Ajusta o 3D e a camada de efeitos ao tamanho do palco. */
    resize(width: number, height: number): void {
        this.size = { width, height }
        this.renderer?.resize(width, height)
        const effects = this.surfaces.getEffects()
        if (effects) {
            effects.width = width
            effects.height = height
        }
    }

    /** Volta ao ponto de partida. */
    readonly restart = (): void => {
        this.world?.reset()
        this.triggers.left.reset()
        this.triggers.right.reset()
        this.held = { left: false, right: false }
        this.lastThrow = null
        this.counted = { webs: 0, misses: 0 }
        this.emit()
    }

    private start(city: City): void {
        const canvas = this.surfaces.getScene()
        if (!canvas) return
        try {
            this.renderer = this.env.createRenderer(canvas, city)
        } catch (error) {
            this.fail(`Este navegador não conseguiu iniciar o 3D: ${messageOf(error)}`)
            return
        }
        this.city = city
        this.world = createSwingWorld(createCityIndex(city))
        this.phase = 'playing'
        if (this.size.width > 0) this.resize(this.size.width, this.size.height)
        this.sync()
    }

    private fail(message: string): void {
        this.phase = 'error'
        this.failure = message
        this.stopLoop()
        this.emit()
    }

    private sync(): void {
        if (this.attached && this.cameraActive && this.trackerStatus === 'idle') this.loadTracker()
        if (!this.cameraActive && this.tracker) this.releaseTracker()
        this.ensureLoop()
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
                this.sync()
            },
            (error: unknown) => {
                if (token !== this.loadToken || !this.attached) return
                this.trackerStatus = 'error'
                this.trackerFailure = messageOf(error)
                this.sync()
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

    private dropHand(): void {
        this.hand = null
        this.hands = []
        this.webHandIndexes = new Set()
        const now = this.env.now()
        this.held = {
            left: this.triggers.left.update(null, now),
            right: this.triggers.right.update(null, now),
        }
        const overlay = this.surfaces.getOverlay()
        const video = this.surfaces.getVideo()
        if (overlay && video) drawHands(overlay, video, [])
    }

    private ensureLoop(): void {
        if (this.loop !== null || !this.attached || this.phase !== 'playing') return
        this.lastNow = null
        this.loop = this.env.requestFrame(this.frame)
    }

    private stopLoop(): void {
        if (this.loop !== null) this.env.cancelFrame(this.loop)
        this.loop = null
        this.unwatchCameraFrames()
    }

    private readonly frame = (): void => {
        this.loop = null
        const { world, renderer } = this
        if (!world || !renderer || !this.attached) return
        const now = this.env.now()
        const dt = this.lastNow === null ? 0 : (now - this.lastNow) / 1000
        this.lastNow = now

        this.readHand(now)
        const steering = this.steeringHand()
        const look = steerFromHand(steering?.landmarks ?? null)
        const left = this.held.left || this.keys.has(this.sideKeys.left)
        const right = this.held.right || this.keys.has(this.sideKeys.right)
        const side: WebSide = left && right ? 0 : left ? -1 : right ? 1 : 0
        const input: SwingInput = {
            webHeld: left || right || this.keys.has(' '),
            webSide: side,
            yawRate: clamp(look.yawRate + this.keyAxis('ArrowRight', 'ArrowLeft')),
            pitchRate: clamp(look.pitchRate + this.keyAxis('ArrowUp', 'ArrowDown')),
        }
        world.advance(input, dt)
        this.noteThrow(world)
        renderer.render(world.state)

        const effects = this.surfaces.getEffects()
        const context = effects?.getContext('2d')
        if (effects && context) {
            const { velocity } = world.state
            const speed = Math.hypot(velocity.x, velocity.y, velocity.z)
            drawSpeedLines(context, effects.width, effects.height, speed / DEFAULT_SWING.maxSpeed, now / 1000)
            this.drawTargets(context, effects, renderer, world)
        }

        if (now - this.lastEmitAt >= PUBLISH_INTERVAL_MS) this.emit()
        this.loop = this.env.requestFrame(this.frame)
    }

    /** Guarda como terminou o último lançamento de teia, para a dica da tela. */
    private noteThrow(world: SwingWorld): void {
        const { webs, misses } = world.state.stats
        if (webs > this.counted.webs) this.lastThrow = 'hit'
        else if (misses > this.counted.misses) this.lastThrow = 'miss'
        this.counted = { webs, misses }
    }

    /** Mostra, antes de lançar, onde a teia prenderia a partir de cada mão. */
    private drawTargets(
        context: CanvasRenderingContext2D,
        effects: HTMLCanvasElement,
        renderer: SwingRenderer,
        world: SwingWorld,
    ): void {
        if (world.state.web || !renderer.project) return
        const sides = [
            { side: -1 as const, label: 'esq.' },
            { side: 1 as const, label: 'dir.' },
        ]
        for (const { side, label } of sides) {
            const target = world.aim(side)
            const point = target ? renderer.project(target) : null
            if (point) drawReticle(context, reticlePlacement(point, effects.width, effects.height), label)
        }
    }

    /** A mão que gira a câmera: a primeira que não está fazendo o gesto de teia. */
    private steeringHand(): TrackedHand | null {
        for (let index = 0; index < this.hands.length; index++) {
            if (!this.webHandIndexes.has(index)) return this.hands[index] ?? null
        }
        return null
    }

    /**
     * Lê as mãos quando a câmera entregou um quadro novo; sem quadros por um tempo, as mãos
     * se perdem. Cada mão vira o gesto de teia do seu lado (esquerda ou direita da tela).
     */
    private readHand(now: number): void {
        const { tracker } = this
        const video = this.surfaces.getVideo()
        if (!tracker || !video || !this.cameraActive) return
        if (video.readyState >= 2 && video.videoWidth > 0 && this.takeNewCameraFrame(video)) {
            let hands: TrackedHand[]
            try {
                hands = this.detectHands(tracker, video, now)
            } catch (error) {
                this.releaseTracker()
                this.trackerStatus = 'error'
                this.trackerFailure = messageOf(error)
                this.dropHand()
                return
            }
            this.lastHandAt = now
            this.hands = hands
            this.hand = hands[0] ?? null
            const signals = this.signalsBySide(hands)
            this.held = {
                left: this.triggers.left.update(signals.left, now),
                right: this.triggers.right.update(signals.right, now),
            }
            const overlay = this.surfaces.getOverlay()
            if (overlay) {
                drawHands(
                    overlay,
                    video,
                    hands.map((tracked) => tracked.landmarks),
                )
            }
        } else if (this.hands.length > 0 && now - this.lastHandAt > STALE_HAND_MS) {
            this.dropHand()
        }
    }

    private detectHands(tracker: HandTracker, video: HTMLVideoElement, now: number): TrackedHand[] {
        if (tracker.detectAll) return tracker.detectAll(video, now).slice(0, 2)
        const single = tracker.detect(video, now)
        return single ? [single] : []
    }

    /**
     * O gesto de teia de cada lado da tela. Com duas mãos, a mais à esquerda da tela
     * espelhada é a esquerda; com uma, vale o lado em que ela aparece.
     */
    private signalsBySide(hands: TrackedHand[]): {
        left: TriggerGesture | null
        right: TriggerGesture | null
    } {
        const signals: { left: TriggerGesture | null; right: TriggerGesture | null } = {
            left: null,
            right: null,
        }
        this.webHandIndexes = new Set()
        // A imagem da câmera é invertida: o maior x cru fica mais à esquerda na tela.
        const order = hands
            .map((tracked, index) => ({ tracked, index, x: tracked.landmarks[9]?.x ?? 0.5 }))
            .sort((a, b) => b.x - a.x)
        order.forEach(({ tracked, index }, position) => {
            const side = order.length === 2 ? (position === 0 ? 'left' : 'right') : handSide(tracked.landmarks)
            const signal = webSignal(tracked.landmarks, tracked.gesture)
            signals[side] = signal
            if (signal && signal.name === 'ILoveYou' && signal.score >= 0.7) this.webHandIndexes.add(index)
        })
        return signals
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

    private keyAxis(positive: string, negative: string): number {
        return (this.keys.has(positive) ? 1 : 0) - (this.keys.has(negative) ? 1 : 0)
    }

    private readonly onKeyDown = (event: KeyboardEvent): void => {
        if (!CONTROL_KEYS.has(event.key)) return
        event.preventDefault()
        this.keys.add(event.key)
    }

    private readonly onKeyUp = (event: KeyboardEvent): void => {
        this.keys.delete(event.key)
    }

    private emit(): void {
        this.lastEmitAt = this.env.now()
        this.snapshot = this.buildSnapshot()
        for (const listener of [...this.listeners]) listener()
    }

    private buildSnapshot(): SwingSnapshot {
        const state = this.world?.state
        const hud: SwingHud = state
            ? {
                  speedKmh: Math.round(
                      Math.hypot(state.velocity.x, state.velocity.y, state.velocity.z) * 3.6,
                  ),
                  altitude: Math.round(state.position.y),
                  webs: state.stats.webs,
                  distance: Math.round(state.stats.distance),
                  webAttached: state.web !== null,
                  webSide: state.web ? (state.web.side ?? 0) : null,
                  started: state.started,
              }
            : EMPTY_HUD
        return {
            phase: this.phase,
            failure: this.failure,
            trackerStatus: this.trackerStatus,
            trackerFailure: this.trackerFailure,
            handVisible: this.hand !== null,
            gestureHeld: this.held.left || this.held.right,
            held: { ...this.held },
            handsVisible: this.hands.length,
            cue: state ? swingCue(state) : 'start',
            lastThrow: this.lastThrow,
            hud,
            attribution: this.city?.attribution ?? '',
        }
    }
}

/** Teclas que o jogo usa (e que não devem rolar a página). */
const CONTROL_KEYS = new Set([' ', 'z', 'x', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'])

const clamp = (value: number) => Math.max(-1, Math.min(1, value))
