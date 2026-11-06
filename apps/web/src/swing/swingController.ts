import { AsyncTrackerResource } from '../capture/asyncTrackerResource.js'
import { VideoFrameGate } from '../capture/videoFrameGate.js'
import { OnlineSwingSession } from './onlineSession.js'
import { deriveSwingHands } from './handInput.js'
import type {
    SwingEnv,
    SwingSurfaces,
    SwingPhase,
    SwingSnapshot,
    SwingHud,
    LookMode,
    HandDebug,
} from './swingTypes.js'
export type {
    SwingTrackerStatus,
    SwingPhase,
    LookMode,
    SwingHud,
    SwingEnv,
    SwingSurfaces,
    HandDebug,
    HeadDebug,
    SwingSnapshot,
} from './swingTypes.js'
import {
    advanceTraining,
    EMPTY_TRAINING,
    type TrainingProgress,
} from './training.js'
import {
    type City,
    type SwingCue,
    type SwingInput,
    type SwingState,
    type SwingWorld,
    type HeadLook,
    type HeadClimb,
    type HeadClimbState,
    type HeadLookState,
    type FaceReading,
    type LockGesture,
    type TriggerGesture,
    type WebTrigger,
    DEFAULT_SWING,
    createCityIndex,
    createHeadClimb,
    createHeadLook,
    createLockGesture,
    createSwingWorld,
    createWebTrigger,
    swingCue,
} from '@guess-my-move/swing'

import { drawHands } from '../round/handOverlay.js'
import { drawFace } from '../round/faceOverlay.js'
import { type FaceTracker } from '../tracker/faceTracker.js'
import { type HandTracker, type TrackedHand } from '../tracker/handTracker.js'
import { type SwingRenderer } from './cityRenderer.js'
import { drawReticle, reticlePlacement } from './reticle.js'
import { drawSpeedLines } from './speedLines.js'

/** Olhar da cabeça antes de qualquer leitura: sem calibração, seguindo e sem direção travada. */
const INITIAL_HEAD: HeadLookState = {
    yawOffset: 0,
    pitchOffset: 0,
    calibrated: false,
    faceVisible: false,
    mode: 'following',
    liveYaw: 0,
    livePitch: 0,
    lockedYaw: 0,
    lockedPitch: 0,
}

const PUBLISH_INTERVAL_MS = 100
/** Sem quadro novo da câmera por este tempo, a mão conta como perdida. */
const STALE_HAND_MS = 500
/** A dica "Parede: abra a mão" fica por este tempo após o último contato, para não piscar. */
const WALL_HINT_MS = 600

const messageOf = (error: unknown) =>
    error instanceof Error && error.message
        ? error.message
        : 'Falha desconhecida.'

const EMPTY_HUD: SwingHud = {
    speedKmh: 0,
    altitude: 0,
    webs: 0,
    distance: 0,
    webAttached: false,
    webSides: [],
    gripped: false,
    started: false,
}

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
    private readonly onlineSession: OnlineSwingSession | null
    private world: SwingWorld | null = null
    private renderer: SwingRenderer | null = null
    private size = { width: 0, height: 0 }
    private readonly handResource = new AsyncTrackerResource<HandTracker>()
    private readonly faceResource = new AsyncTrackerResource<FaceTracker>()
    private get tracker() {
        return this.handResource.value
    }
    private get trackerStatus() {
        return this.handResource.status
    }
    private get trackerFailure() {
        return this.handResource.error
    }
    private get faceTracker() {
        return this.faceResource.value
    }
    private get faceTrackerStatus() {
        return this.faceResource.status
    }
    private get faceTrackerFailure() {
        return this.faceResource.error
    }
    private readonly headLook: HeadLook = createHeadLook()
    /** Escalar olhando: segurar o olhar para cima/baixo agarrado, por ~2 s, escala. */
    private readonly headClimb: HeadClimb = createHeadClimb()
    private headClimbState: HeadClimbState = {
        climb: 0,
        intent: null,
        progress: 0,
        climbing: false,
    }
    /** Filtro do gesto de travar a direção (dedão para baixo): tempo mínimo e tolerância a quadros ruins. */
    private readonly lockGesture: LockGesture = createLockGesture()
    /** Alguma mão está no gesto de travar no quadro de câmera mais recente. */
    private lockPose = false
    private headState: HeadLookState = INITIAL_HEAD
    /** Último desvio da cabeça já aplicado ao olhar; o próximo passo soma só a variação. */
    private appliedHead = { yaw: 0, pitch: 0 }
    /** Leitura do rosto no quadro de câmera mais recente (`null` sem rosto). */
    private lastFace: FaceReading | null = null
    private faceSamplePending = false
    /** Direção do olhar: `face` (padrão) usa a cabeça; `auto` não carrega o detector de rosto. */
    private lookMode: LookMode = 'face'
    private hand: TrackedHand | null = null
    private hands: TrackedHand[] = []
    private handDebug: HandDebug[] = []
    private pulls = { left: false, right: false }
    private lastHandAt = 0
    private held = { left: false, right: false }
    /** Mãos abertas em contato com a parede: agarrar daquele lado. */
    private grabs = { left: false, right: false }
    /** Sinal de escalada da câmera (-1 a 1), do movimento vertical das mãos. */
    private climb = 0
    /** Punho fechado de alguma mão: pedido de soltar da parede. */
    private releaseFist = false
    /** Posição vertical anterior do pulso de cada mão (y), para o sinal de escalada. */
    private prevWrist: { left: number | null; right: number | null } = {
        left: null,
        right: null,
    }
    /** Último instante, em ms, em que o jogador encostou numa parede (para a dica não piscar). */
    private wallContactAt = -Infinity
    private readonly sideKeys = { left: 'z', right: 'x' }
    private readonly pullKey = 'c'
    private readonly grabKey = 'v'
    private lastThrow: 'hit' | 'miss' | null = null
    private counted = { webs: 0, misses: 0 }
    private readonly cameraFrames = new VideoFrameGate()
    private loop: number | null = null
    private lastNow: number | null = null
    private lastEmitAt = 0
    private training: TrainingProgress = EMPTY_TRAINING
    private snapshot: SwingSnapshot

    constructor(env: SwingEnv) {
        this.env = env
        this.onlineSession = env.online
            ? new OnlineSwingSession(env.online)
            : null
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
        this.env.keys.addEventListener(
            'keydown',
            this.onKeyDown as EventListener,
        )
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
                this.fail(
                    `Não foi possível carregar a cidade: ${messageOf(error)}`,
                )
            },
        )
        this.sync()
    }

    /** Desliga: encerra o laço, libera o 3D e o detector e solta o teclado. */
    detach(): void {
        this.attached = false
        this.attachToken++
        this.env.keys.removeEventListener(
            'keydown',
            this.onKeyDown as EventListener,
        )
        this.env.keys.removeEventListener(
            'keyup',
            this.onKeyUp as EventListener,
        )
        this.keys.clear()
        this.stopLoop()
        this.renderer?.dispose()
        this.renderer = null
        this.world = null
        this.onlineSession?.reset()
        this.handResource.release()
        this.faceResource.release()
        this.headLook.reset()
        this.headClimb.reset()
        this.lockGesture.reset()
        this.headState = INITIAL_HEAD
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
        if (!this.lastFace?.orientation) return
        this.headLook.recenter()
        // Encerra também o gesto em andamento: "Centralizar" sempre sai da trava.
        this.lockGesture.reset()
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
        this.headClimb.reset()
        this.lockGesture.reset()
        this.headState = INITIAL_HEAD
        this.appliedHead = { yaw: 0, pitch: 0 }
        this.lastFace = null
        this.faceSamplePending = false
        this.sync()
    }

    /** Ajusta o 3D e a camada de efeitos ao tamanho do palco. */
    readonly resize = (width: number, height: number): void => {
        if (
            width <= 0 ||
            height <= 0 ||
            (width === this.size.width && height === this.size.height)
        )
            return
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
        if (this.env.online) return
        this.resetRound()
    }

    private resetRound(): void {
        this.training = EMPTY_TRAINING
        this.world?.reset()
        this.triggers.left.reset()
        this.triggers.right.reset()
        this.held = { left: false, right: false }
        this.pulls = { left: false, right: false }
        this.grabs = { left: false, right: false }
        this.climb = 0
        this.releaseFist = false
        this.prevWrist = { left: null, right: null }
        this.wallContactAt = -Infinity
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
            this.fail(
                `Este navegador não conseguiu iniciar o 3D: ${messageOf(error)}`,
            )
            return
        }
        this.city = city
        this.world = createSwingWorld(
            createCityIndex(city),
            this.env.config ?? DEFAULT_SWING,
        )
        this.phase = 'playing'
        if (this.size.width > 0)
            this.renderer.resize(this.size.width, this.size.height)
        this.sync()
    }

    private fail(message: string): void {
        this.phase = 'error'
        this.failure = message
        this.stopLoop()
        this.emit()
    }

    private sync(): void {
        if (this.attached && this.cameraActive && this.trackerStatus === 'idle')
            this.loadTracker()
        if (!this.cameraActive && this.trackerStatus !== 'idle')
            this.releaseTracker()
        if (
            this.attached &&
            this.cameraActive &&
            this.lookMode === 'face' &&
            this.env.createFaceTracker &&
            this.faceTrackerStatus === 'idle'
        ) {
            this.loadFaceTracker()
        }
        if (
            (!this.cameraActive || this.lookMode === 'auto') &&
            this.faceTrackerStatus !== 'idle'
        )
            this.releaseFaceTracker()
        this.ensureLoop()
        this.emit()
    }

    /** Carrega o detector de rosto (opcional); sua falha não impede o jogo nem o detector de mão. */
    private loadFaceTracker(): void {
        const create = this.env.createFaceTracker
        if (!create) return
        this.faceResource.load(create, {
            alive: () =>
                this.attached && this.cameraActive && this.lookMode === 'face',
            onReady: () => {
                this.headLook.reset()
                this.headClimb.reset()
                this.lockGesture.reset()
                this.appliedHead = { yaw: 0, pitch: 0 }
                this.sync()
            },
            onError: () => this.emit(),
        })
    }

    private releaseFaceTracker(): void {
        this.faceResource.release()
        this.headLook.reset()
        this.headClimb.reset()
        this.lockGesture.reset()
        this.headState = INITIAL_HEAD
        this.appliedHead = { yaw: 0, pitch: 0 }
    }

    private loadTracker(): void {
        this.handResource.load(() => this.env.createTracker(), {
            alive: () => this.attached && this.cameraActive,
            onReady: () => {
                this.watchCameraFrames()
                this.sync()
            },
            onError: () => this.sync(),
        })
    }

    private releaseTracker(): void {
        this.unwatchCameraFrames()
        this.handResource.release()
    }

    private dropHand(): void {
        this.hand = null
        this.hands = []
        this.handDebug = []
        this.grabs = { left: false, right: false }
        this.lockPose = false
        this.climb = 0
        this.releaseFist = false
        this.prevWrist = { left: null, right: null }
        this.lastFace = null
        this.faceSamplePending = false
        const now = this.env.now()
        this.applyTriggers({ left: null, right: null }, now)
        const overlay = this.surfaces.getOverlay()
        const video = this.surfaces.getVideo()
        if (overlay && video) drawHands(overlay, video, [])
    }

    private ensureLoop(): void {
        if (this.loop !== null || !this.attached || this.phase !== 'playing')
            return
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
        const touchingWall = world.state.touchingWall
        const gripped = world.state.grip !== null
        // Precedência da palma aberta: só agarra em contato com a parede; senão a palma segue
        // soltando a teia. A tecla V agarra (centro) enquanto segurada.
        const grabKey = this.keys.has(this.grabKey)
        const grab =
            touchingWall || gripped
                ? {
                      left: this.grabs.left,
                      right: this.grabs.right,
                      center: grabKey,
                  }
                : { center: grabKey && touchingWall }
        // Escalada: a câmera dá o movimento das mãos; agarrado, as setas sobem/descem também.
        // No modo Rosto, agarrado, segurar o olhar para cima/baixo por ~2 s também escala.
        const keyClimb = gripped ? this.keyAxis('ArrowUp', 'ArrowDown') : 0
        const head = this.updateHeadLook(dt)
        this.headClimbState = this.headClimb.update(
            {
                // Só a parte viva da cabeça: a direção travada nunca conta como "olhar para cima".
                pitch: this.headState.livePitch,
                yaw: this.headState.liveYaw,
                active:
                    gripped &&
                    this.headState.mode === 'following' &&
                    this.lookMode === 'face' &&
                    this.faceTracker !== null &&
                    this.headState.faceVisible &&
                    this.headState.calibrated,
            },
            dt * 1000,
        )
        const climb = [this.climb, keyClimb, this.headClimbState.climb].reduce(
            (best, value) => (Math.abs(value) > Math.abs(best) ? value : best),
        )
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
            // Mãos abertas em contato com a parede agarram; V agarra pelo teclado.
            grab,
            climb,
            releaseFist: this.releaseFist,
            // A câmera é automática (segue o movimento); as setas só ajustam o olhar (fora do agarre).
            yawRate: this.keyAxis('ArrowRight', 'ArrowLeft'),
            pitchRate: gripped ? 0 : this.keyAxis('ArrowUp', 'ArrowDown'),
            // A cabeça soma um desvio ao olhar enquanto há rosto; a mira da teia segue junto.
            lookDelta: head.delta,
            lookActive: head.active,
            // A direção travada vira a nova frente: o acompanhamento automático mira o rumo mais ela.
            lookBias: head.bias,
        }
        if (this.onlineSession) {
            const view = this.onlineSession.advance(world, input, now, dt, () =>
                this.resetRound(),
            )
            renderer.setOnline?.(view.room, view.playerId, Math.min(dt, 0.1))
        } else world.advance(input, dt)
        this.training = advanceTraining(this.training, {
            webSides: world.state.webs.map((web) => web.side),
            pulling: world.state.webs.some((web) =>
                web.side === -1
                    ? input.pull?.left
                    : web.side === 1
                      ? input.pull?.right
                      : input.pull?.center,
            ),
            gripped: world.state.grip !== null,
            headClimbing: this.headClimbState.climbing,
            locked: this.headState.mode === 'locked',
            released:
                !input.held.left && !input.held.right && !input.held.center,
        })
        if (world.state.touchingWall) this.wallContactAt = now
        this.noteThrow(world)
        renderer.render(world.state)

        const effects = this.surfaces.getEffects()
        const context = effects?.getContext('2d')
        if (effects && context) {
            const { velocity } = world.state
            const speed = Math.hypot(velocity.x, velocity.y, velocity.z)
            drawSpeedLines(
                context,
                effects.width,
                effects.height,
                speed / DEFAULT_SWING.maxSpeed,
                now / 1000,
            )
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
    private updateHeadLook(dt: number): {
        delta: { yaw: number; pitch: number }
        active: boolean
        bias: { yaw: number; pitch: number }
    } {
        if (this.faceTracker === null) {
            this.lockGesture.reset()
            return {
                delta: { yaw: 0, pitch: 0 },
                active: false,
                bias: { yaw: 0, pitch: 0 },
            }
        }
        // O gesto de travar só vale no modo Rosto (o detector de rosto só existe nele).
        const lock = this.lockGesture.update(this.lockPose, dt * 1000)
        this.headState = this.headLook.update(
            this.lastFace?.orientation ?? null,
            dt,
            lock,
            this.faceSamplePending,
        )
        this.faceSamplePending = false
        const delta = {
            yaw: this.headState.yawOffset - this.appliedHead.yaw,
            pitch: this.headState.pitchOffset - this.appliedHead.pitch,
        }
        this.appliedHead = {
            yaw: this.headState.yawOffset,
            pitch: this.headState.pitchOffset,
        }
        // Ativa (segura o olhar contra o acompanhamento automático) enquanto há rosto e a cabeça
        // desvia o olhar. Travada, o acompanhamento mira o rumo mais a direção travada (`bias`),
        // então a cabeça não comanda e o olhar fica relativo ao movimento.
        const active =
            this.headState.mode === 'following' &&
            this.headState.faceVisible &&
            (Math.abs(this.headState.liveYaw) > 1e-4 ||
                Math.abs(this.headState.livePitch) > 1e-4 ||
                Math.abs(delta.yaw) > 1e-5 ||
                Math.abs(delta.pitch) > 1e-5)
        return {
            delta,
            active,
            bias: {
                yaw: this.headState.lockedYaw,
                pitch: this.headState.lockedPitch,
            },
        }
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
            if (point)
                drawReticle(
                    context,
                    reticlePlacement(point, effects.width, effects.height),
                    label,
                )
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
        if (
            video.readyState >= 2 &&
            video.videoWidth > 0 &&
            this.takeNewCameraFrame(video)
        ) {
            // O MESMO quadro da câmera alimenta mãos e rosto.
            this.readFace(video, now)
            let hands: TrackedHand[] = []
            if (tracker) {
                try {
                    hands = this.detectHands(tracker, video, now)
                } catch (error) {
                    this.releaseTracker()
                    this.handResource.fail(error)
                    this.dropHand()
                    return
                }
                this.lastHandAt = now
                this.hands = hands
                this.hand = hands[0] ?? null
                this.applyTriggers(this.signalsBySide(hands), now)
            }
            this.drawOverlay(video, hands)
        } else if (
            this.hands.length > 0 &&
            now - this.lastHandAt > STALE_HAND_MS
        ) {
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
        if (
            this.lookMode === 'face' &&
            this.lastFace &&
            this.lastFace.landmarks.length > 0
        ) {
            drawFace(
                overlay,
                video,
                this.lastFace.landmarks,
                this.lastFace.orientation,
            )
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
            this.faceSamplePending = true
        } catch (error) {
            this.releaseFaceTracker()
            this.faceResource.fail(error)
            this.lastFace = null
            this.faceSamplePending = false
        }
    }

    private detectHands(
        tracker: HandTracker,
        video: HTMLVideoElement,
        now: number,
    ): TrackedHand[] {
        if (tracker.detectAll) return tracker.detectAll(video, now).slice(0, 2)
        const single = tracker.detect(video, now)
        return single ? [single] : []
    }

    /**
     * O gesto de teia de cada lado da tela, e os sinais do agarre. Com duas mãos, a mais à
     * esquerda da tela espelhada é a esquerda; com uma, vale o lado em que ela aparece. Além
     * do gesto de teia, lê a palma aberta (candidata a agarrar), o punho fechado (soltar da
     * parede) e o deslocamento vertical do pulso de cada mão (escalada).
     */
    private signalsBySide(hands: TrackedHand[]): {
        left: TriggerGesture | null
        right: TriggerGesture | null
    } {
        const state = deriveSwingHands(
            hands,
            this.world?.state.grip != null,
            this.prevWrist,
        )
        this.handDebug = state.debug
        this.grabs = state.grabs
        this.lockPose = state.lockPose
        this.climb = state.climb
        this.releaseFist = state.releaseFist
        this.prevWrist = state.wrist
        return state.signals
    }

    private takeNewCameraFrame(video: HTMLVideoElement): boolean {
        return this.cameraFrames.take(video)
    }
    private watchCameraFrames(): void {
        this.cameraFrames.watch(this.surfaces.getVideo())
    }
    private unwatchCameraFrames(): void {
        this.cameraFrames.unwatch()
    }

    private keyAxis(positive: string, negative: string): number {
        return (
            (this.keys.has(positive) ? 1 : 0) -
            (this.keys.has(negative) ? 1 : 0)
        )
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
                      Math.hypot(
                          state.velocity.x,
                          state.velocity.y,
                          state.velocity.z,
                      ) * 3.6,
                  ),
                  altitude: Math.round(state.position.y),
                  webs: state.stats.webs,
                  distance: Math.round(state.stats.distance),
                  webAttached: state.webs.length > 0,
                  webSides: state.webs.map((web) => web.side),
                  gripped: state.grip !== null,
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
            headClimb: {
                intent: this.headClimbState.intent,
                progress: this.headClimbState.progress,
                climbing: this.headClimbState.climbing,
            },
            headDebug: {
                lookMode: this.lookMode,
                faceVisible: this.headState.faceVisible,
                calibrated: this.headState.calibrated,
                yawDeg: Math.round((this.headState.yawOffset * 180) / Math.PI),
                pitchDeg: Math.round(
                    (this.headState.pitchOffset * 180) / Math.PI,
                ),
                climbIntent: this.headClimbState.intent,
                climbProgress: this.headClimbState.progress,
                lockMode: this.headState.mode,
                lockPose: this.lockPose,
            },
            headLock: { mode: this.headState.mode },
            grabDebug: {
                touchingWall: state?.touchingWall ?? false,
                gripped: state?.grip != null,
                climb: this.climb,
            },
            cue: this.currentCue(state),
            lastThrow: this.lastThrow,
            hud,
            attribution: this.city?.attribution ?? '',
            training: this.training,
        }
    }

    /**
     * O gesto a sugerir. Parte de `swingCue`, mas mantém a dica de parede ("abra a mão para
     * agarrar") por um instante após o último contato, para o status não piscar quando o
     * jogador roça a fachada.
     */
    private currentCue(state: SwingState | undefined): SwingCue {
        if (!state) return 'start'
        const base = swingCue(state)
        if (
            base === 'wall' ||
            state.grip !== null ||
            state.webs.length > 0 ||
            !state.started
        )
            return base
        const recentWall = this.env.now() - this.wallContactAt <= WALL_HINT_MS
        return recentWall ? 'wall' : base
    }
}

/** Teclas que o jogo usa (e que não devem rolar a página). */
const CONTROL_KEYS = new Set([
    ' ',
    'z',
    'x',
    'c',
    'v',
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'ArrowDown',
])
