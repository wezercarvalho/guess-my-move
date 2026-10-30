import {
    type City,
    type SwingCue,
    type SwingInput,
    type SwingWorld,
    type HandMetrics,
    type HeadLook,
    type HeadLookState,
    type FaceReading,
    type TriggerGesture,
    type WebSide,
    type WebTrigger,
    DEFAULT_SWING,
    createCityIndex,
    createHeadLook,
    createSwingWorld,
    createWebTrigger,
    handMetrics,
    handSide,
    swingCue,
    webSignal,
} from '@guess-my-move/swing'

import { drawHands } from '../round/handOverlay.js'
import { drawFace } from '../round/faceOverlay.js'
import { type CreateFaceTracker, type FaceTracker } from '../tracker/faceTracker.js'
import { type CreateHandTracker, type HandTracker, type TrackedHand } from '../tracker/handTracker.js'
import { type CreateSwingRenderer, type SwingRenderer } from './cityRenderer.js'
import { drawReticle, reticlePlacement } from './reticle.js'
import { drawSpeedLines } from './speedLines.js'

export type SwingTrackerStatus = 'idle' | 'loading' | 'ready' | 'error'

/** `loading`: baixando a cidade; `playing`: jogo rodando; `error`: cidade ou 3D indisponível. */
export type SwingPhase = 'loading' | 'playing' | 'error'

/** Direção do olhar: `auto` (câmera segue o movimento, setas ajustam) ou `face` (a cabeça soma o desvio). */
export type LookMode = 'auto' | 'face'

export interface SwingHud {
    speedKmh: number
    /** Altura do olho acima do chão, em metros. */
    altitude: number
    webs: number
    distance: number
    webAttached: boolean
    /** Lados das teias presas (-1 esquerda, 0 centro, 1 direita); vazio sem teia. */
    webSides: WebSide[]
    /** O primeiro gesto de teia já aconteceu; antes disso o jogador espera no início. */
    started: boolean
}

/** Dependências do controlador; em testes, a cidade, o 3D, o relógio e as teclas são simulados. */
export interface SwingEnv {
    createTracker: CreateHandTracker
    /** Detector de rosto para girar a câmera com a cabeça; ausente desliga o recurso (fallback = hoje). */
    createFaceTracker?: CreateFaceTracker
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

/** O que o detector lê de uma mão, para o painel de depuração. */
export interface HandDebug {
    side: 'esq.' | 'dir.'
    /** Rótulo do reconhecedor de gestos, se houver. */
    label: string | null
    /** Gesto que o jogo entendeu (a geometria decide primeiro), se algum. */
    signal: string | null
    metrics: HandMetrics | null
}

/** O que o detector de rosto lê da cabeça, para o painel de depuração. */
export interface HeadDebug {
    /** Direção do olhar ativa: `auto` ou `face`. */
    lookMode: LookMode
    /** Há rosto à vista. */
    faceVisible: boolean
    /** O neutro já foi calibrado. */
    calibrated: boolean
    /** Desvio de guinada aplicado ao olhar, em graus. */
    yawDeg: number
    /** Desvio de inclinação aplicado ao olhar, em graus. */
    pitchDeg: number
}

export interface SwingSnapshot {
    phase: SwingPhase
    failure: string | null
    trackerStatus: SwingTrackerStatus
    trackerFailure: string | null
    /** Estado do detector de rosto (câmera que gira com a cabeça). */
    faceTrackerStatus: SwingTrackerStatus
    faceTrackerFailure: string | null
    /** Há rosto à vista agora. */
    faceVisible: boolean
    /** Direção do olhar ativa: `auto` (sem rosto) ou `face` (câmera pela cabeça). */
    lookMode: LookMode
    handVisible: boolean
    /** O gesto de teia está sendo segurado (não conta a tecla). */
    gestureHeld: boolean
    /** Qual mão está segurando o gesto de teia. */
    held: { left: boolean; right: boolean }
    /** Quantas mãos a câmera vê agora. */
    handsVisible: number
    /** O punho está fechado com a teia presa (puxando). */
    pulling: boolean
    /** Leitura de cada mão, para o painel de depuração. */
    handDebug: readonly HandDebug[]
    /** Leitura da cabeça, para o painel de depuração. */
    headDebug: HeadDebug
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

const EMPTY_HUD: SwingHud = { speedKmh: 0, altitude: 0, webs: 0, distance: 0, webAttached: false, webSides: [], started: false }

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
    private faceTracker: FaceTracker | null = null
    private faceTrackerStatus: SwingTrackerStatus = 'idle'
    private faceTrackerFailure: string | null = null
    private faceLoadToken = 0
    private readonly headLook: HeadLook = createHeadLook()
    private headState: HeadLookState = { yawOffset: 0, pitchOffset: 0, calibrated: false, faceVisible: false }
    /** Último desvio da cabeça já aplicado ao olhar; o próximo passo soma só a variação. */
    private appliedHead = { yaw: 0, pitch: 0 }
    /** Leitura do rosto no quadro de câmera mais recente (`null` sem rosto). */
    private lastFace: FaceReading | null = null
    /** Direção do olhar: `face` (padrão) usa a cabeça; `auto` não carrega o detector de rosto. */
    private lookMode: LookMode = 'face'
    private hand: TrackedHand | null = null
    private hands: TrackedHand[] = []
    private handDebug: HandDebug[] = []
    private pulls = { left: false, right: false }
    private lastHandAt = 0
    private held = { left: false, right: false }
    private readonly sideKeys = { left: 'z', right: 'x' }
    private readonly pullKey = 'c'
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
        this.faceLoadToken++
        this.faceTracker?.close()
        this.faceTracker = null
        this.faceTrackerStatus = 'idle'
        this.headLook.reset()
        this.headState = { yawOffset: 0, pitchOffset: 0, calibrated: false, faceVisible: false }
        this.appliedHead = { yaw: 0, pitch: 0 }
        this.hand = null
        this.snapshot = this.buildSnapshot()
    }

    setCamera(active: boolean): void {
        this.cameraActive = active
        if (!active) this.dropHand()
        this.sync()
    }

    /** Recalibra o neutro da cabeça na pose atual ("Centralizar"). */
    readonly recenterHead = (): void => {
        this.headLook.recenter()
        this.emit()
    }

    /**
     * Escolhe a direção do olhar. `auto` segue o movimento (como antes do #80) e NÃO carrega
     * o detector de rosto (libera se já carregado); `face` soma o desvio da cabeça. Ao sair de
     * `face`, o desvio já aplicado é descartado sem salto (o olhar fica onde está e o
     * acompanhamento automático assume daí). Seguro de trocar durante o jogo.
     */
    readonly setLookMode = (mode: LookMode): void => {
        if (mode === this.lookMode) return
        this.lookMode = mode
        if (mode === 'auto' && this.faceTracker) this.releaseFaceTracker()
        // Em qualquer troca, zera o "já aplicado" para não somar/subtrair o desvio de uma vez.
        this.headLook.reset()
        this.headState = { yawOffset: 0, pitchOffset: 0, calibrated: false, faceVisible: false }
        this.appliedHead = { yaw: 0, pitch: 0 }
        this.lastFace = null
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
        this.pulls = { left: false, right: false }
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
        if (this.attached && this.cameraActive && this.lookMode === 'face' && this.env.createFaceTracker && this.faceTrackerStatus === 'idle') {
            this.loadFaceTracker()
        }
        if ((!this.cameraActive || this.lookMode === 'auto') && this.faceTracker) this.releaseFaceTracker()
        this.ensureLoop()
        this.emit()
    }

    /** Carrega o detector de rosto (opcional); sua falha não impede o jogo nem o detector de mão. */
    private loadFaceTracker(): void {
        const create = this.env.createFaceTracker
        if (!create) return
        const token = ++this.faceLoadToken
        this.faceTrackerStatus = 'loading'
        create().then(
            (tracker) => {
                if (token !== this.faceLoadToken || !this.attached) {
                    tracker.close()
                    return
                }
                this.faceTracker = tracker
                this.faceTrackerStatus = 'ready'
                this.headLook.reset()
                this.appliedHead = { yaw: 0, pitch: 0 }
                this.sync()
            },
            (error: unknown) => {
                if (token !== this.faceLoadToken || !this.attached) return
                this.faceTrackerStatus = 'error'
                this.faceTrackerFailure = messageOf(error)
                this.emit()
            },
        )
    }

    private releaseFaceTracker(): void {
        this.faceLoadToken++
        this.faceTracker?.close()
        this.faceTracker = null
        this.faceTrackerStatus = 'idle'
        this.headLook.reset()
        this.headState = { yawOffset: 0, pitchOffset: 0, calibrated: false, faceVisible: false }
        this.appliedHead = { yaw: 0, pitch: 0 }
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
        this.handDebug = []
        this.lastFace = null
        const now = this.env.now()
        this.applyTriggers({ left: null, right: null }, now)
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
        const head = this.updateHeadLook(dt)
        const input: SwingInput = {
            // Cada mão segura a própria teia; Espaço é a teia do centro (teclado).
            held: {
                left: this.held.left || this.keys.has(this.sideKeys.left),
                right: this.held.right || this.keys.has(this.sideKeys.right),
                center: this.keys.has(' '),
            },
            // O punho de cada mão puxa a teia dela; a tecla C puxa todas as presas.
            pull: this.keys.has(this.pullKey)
                ? { left: true, center: true, right: true }
                : { left: this.pulls.left, right: this.pulls.right },
            // A câmera é automática (segue o movimento); as setas só ajustam o olhar.
            yawRate: this.keyAxis('ArrowRight', 'ArrowLeft'),
            pitchRate: this.keyAxis('ArrowUp', 'ArrowDown'),
            // A cabeça soma um desvio ao olhar enquanto há rosto; a mira da teia segue junto.
            lookDelta: head.delta,
            lookActive: head.active,
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

    /**
     * Avança o olhar da cabeça com `dt` (a suavização progride a cada quadro de tela, não só
     * quando chega um quadro novo da câmera) e devolve a VARIAÇÃO do desvio desde o último
     * passo, para somar ao olhar sem acumular, e se a cabeça está comandando agora.
     */
    private updateHeadLook(dt: number): { delta: { yaw: number; pitch: number }; active: boolean } {
        if (this.faceTracker === null) return { delta: { yaw: 0, pitch: 0 }, active: false }
        this.headState = this.headLook.update(this.lastFace?.orientation ?? null, dt)
        const delta = {
            yaw: this.headState.yawOffset - this.appliedHead.yaw,
            pitch: this.headState.pitchOffset - this.appliedHead.pitch,
        }
        this.appliedHead = { yaw: this.headState.yawOffset, pitch: this.headState.pitchOffset }
        // Ativa (segura o olhar contra o acompanhamento automático) enquanto há rosto e um desvio.
        const active =
            this.headState.faceVisible &&
            (Math.abs(this.headState.yawOffset) > 1e-4 ||
                Math.abs(this.headState.pitchOffset) > 1e-4 ||
                Math.abs(delta.yaw) > 1e-5 ||
                Math.abs(delta.pitch) > 1e-5)
        return { delta, active }
    }

    /** Mostra, antes de lançar, onde a teia prenderia a partir de cada mão que está sem teia. */
    private drawTargets(
        context: CanvasRenderingContext2D,
        effects: HTMLCanvasElement,
        renderer: SwingRenderer,
        world: SwingWorld,
    ): void {
        if (!renderer.project) return
        const sides = [
            { side: -1 as const, label: 'esq.' },
            { side: 1 as const, label: 'dir.' },
        ]
        for (const { side, label } of sides) {
            if (world.state.webs.some((web) => web.side === side)) continue
            const target = world.aim(side)
            const point = target ? renderer.project(target) : null
            if (point) drawReticle(context, reticlePlacement(point, effects.width, effects.height), label)
        }
    }

    /**
     * Lê as mãos quando a câmera entregou um quadro novo; sem quadros por um tempo, as mãos
     * se perdem. Cada mão vira o gesto de teia do seu lado (esquerda ou direita da tela).
     */
    private readHand(now: number): void {
        const { tracker } = this
        const video = this.surfaces.getVideo()
        if (!video || !this.cameraActive) return
        if (!tracker && !this.faceTracker) return
        if (video.readyState >= 2 && video.videoWidth > 0 && this.takeNewCameraFrame(video)) {
            // O MESMO quadro da câmera alimenta mãos e rosto.
            this.readFace(video, now)
            let hands: TrackedHand[] = []
            if (tracker) {
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
                this.applyTriggers(this.signalsBySide(hands), now)
            }
            this.drawOverlay(video, hands)
        } else if (this.hands.length > 0 && now - this.lastHandAt > STALE_HAND_MS) {
            this.dropHand()
        }
    }

    /**
     * Desenha, no mesmo overlay espelhado, o esqueleto das mãos e — no modo Rosto, com rosto
     * à vista — o esboço esparso do rosto e o eixo do olhar. O desenho das mãos limpa o
     * canvas; o rosto é desenhado por cima. Os pontos do rosto são transitórios, nunca guardados.
     */
    private drawOverlay(video: HTMLVideoElement, hands: TrackedHand[]): void {
        const overlay = this.surfaces.getOverlay()
        if (!overlay) return
        drawHands(
            overlay,
            video,
            hands.map((tracked) => tracked.landmarks),
        )
        if (this.lookMode === 'face' && this.lastFace && this.lastFace.landmarks.length > 0) {
            drawFace(overlay, video, this.lastFace.landmarks, this.lastFace.orientation)
        }
    }

    /** Alimenta o gatilho de cada lado e guarda quem segura a teia e se o punho puxa. */
    private applyTriggers(
        signals: { left: TriggerGesture | null; right: TriggerGesture | null },
        now: number,
    ): void {
        const left = this.triggers.left.update(signals.left, now)
        const right = this.triggers.right.update(signals.right, now)
        this.held = { left: left.held, right: right.held }
        this.pulls = { left: left.pull, right: right.pull }
    }

    /**
     * Lê o rosto no quadro novo e guarda a orientação da cabeça (`null` sem rosto). A falha
     * do detector de rosto o desliga, sem derrubar o jogo nem o detector de mão.
     */
    private readFace(video: HTMLVideoElement, now: number): void {
        const face = this.faceTracker
        if (!face) return
        try {
            this.lastFace = face.detect(video, now)
        } catch (error) {
            this.releaseFaceTracker()
            this.faceTrackerStatus = 'error'
            this.faceTrackerFailure = messageOf(error)
            this.lastFace = null
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
        this.handDebug = []
        // A imagem da câmera é invertida: o maior x cru fica mais à esquerda na tela.
        const order = hands
            .map((tracked, index) => ({ tracked, index, x: tracked.landmarks[9]?.x ?? 0.5 }))
            .sort((a, b) => b.x - a.x)
        order.forEach(({ tracked }, position) => {
            const side = order.length === 2 ? (position === 0 ? 'left' : 'right') : handSide(tracked.landmarks)
            const signal = webSignal(tracked.landmarks, tracked.gesture)
            signals[side] = signal
            this.handDebug.push({
                side: side === 'left' ? 'esq.' : 'dir.',
                label: tracked.gesture?.name ?? null,
                signal: signal?.name ?? null,
                metrics: handMetrics(tracked.landmarks),
            })
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
                  webAttached: state.webs.length > 0,
                  webSides: state.webs.map((web) => web.side),
                  started: state.started,
              }
            : EMPTY_HUD
        return {
            phase: this.phase,
            failure: this.failure,
            trackerStatus: this.trackerStatus,
            trackerFailure: this.trackerFailure,
            faceTrackerStatus: this.faceTrackerStatus,
            faceTrackerFailure: this.faceTrackerFailure,
            faceVisible: this.headState.faceVisible,
            lookMode: this.lookMode,
            handVisible: this.hand !== null,
            gestureHeld: this.held.left || this.held.right,
            held: { ...this.held },
            handsVisible: this.hands.length,
            pulling: this.pulls.left || this.pulls.right,
            handDebug: [...this.handDebug],
            headDebug: {
                lookMode: this.lookMode,
                faceVisible: this.headState.faceVisible,
                calibrated: this.headState.calibrated,
                yawDeg: Math.round((this.headState.yawOffset * 180) / Math.PI),
                pitchDeg: Math.round((this.headState.pitchOffset * 180) / Math.PI),
            },
            cue: state ? swingCue(state) : 'start',
            lastThrow: this.lastThrow,
            hud,
            attribution: this.city?.attribution ?? '',
        }
    }
}

/** Teclas que o jogo usa (e que não devem rolar a página). */
const CONTROL_KEYS = new Set([' ', 'z', 'x', 'c', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'])

