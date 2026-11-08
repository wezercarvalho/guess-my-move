import type {
    Body,
    BotLevel,
    BotPlanner,
    Competitor,
    FlickPhase,
    FieldDecor,
    HandGesture,
    MatchPhase,
    ModeId,
    Opponent,
    Outcome,
    Vec,
} from '@guess-my-move/marbles'
import type {
    CreateHandTracker,
    TrackerDelegate,
} from '../tracker/handTracker.js'
import type { MultiplayerSnapshot } from './multiplayerClient.js'

export type MarblesTrackerStatus = 'idle' | 'loading' | 'ready' | 'error'

/** Modo de tiro: a pinça com arrasto (padrão) ou o estalo do polegar (alpha). */
export type ShotControl = 'pinch' | 'flick'

export type PlayType = 'local' | 'online'

/** O que aconteceu no último estalo, para a depuração. */
export type FlickOutcome =
    'disparado' | 'fraco demais' | 'não sustentado' | 'mão aberta' | 'sem mira'

/** Dependências do controlador; em testes, o relógio e os quadros são controlados. */
export interface MarblesEnv {
    createTracker: CreateHandTracker
    requestFrame: (callback: () => void) => number
    cancelFrame: (handle: number) => void
    /** Relógio monotônico em ms. */
    now: () => number
    /** Planejador do bot (injetável para teste); por padrão, `DEFAULT_BOT`. */
    createBot?: (level: BotLevel) => BotPlanner
    /** Semente base da partida contra o bot (injetável para teste). */
    seed?: number
}

/** Acesso aos elementos da tela, entregue na montagem (nunca durante a renderização). */
export interface MarblesSurfaces {
    getVideo: () => HTMLVideoElement | null
    getOverlay: () => HTMLCanvasElement | null
}

/** Números do painel de depuração. */
export interface MarblesDebug {
    delegate: TrackerDelegate | null
    ratio: number | null
    pinchClosed: boolean
    handVisible: boolean
    frames: number
    cameraFps: number | null
    medianMs: number | null
    p95Ms: number | null
    flick: {
        armed: boolean
        phase: FlickPhase
        gesture: HandGesture | null
        lastOpenSpeed: number | null
        lastRiseMs: number | null
        lastPower: number | null
        lastResult: FlickOutcome | null
    }
}

/** Mira em andamento, exposta à tela para o campo desenhar o elástico/seta. */
export interface AimView {
    pinch: Vec
    shot: { velocity: Vec; power: number } | null
    direction: Vec | null
}

/** Próximo tiro anunciado do adversário antes de ser aplicado. */
export interface OpponentIntent {
    velocity: Vec
    power: number
}

/** Estado da partida exposto à tela. */
export interface MatchView {
    modeId: string
    opponent: Opponent
    phase: MatchPhase
    round: number
    roundsPerMatch: number
    roundOutcomes: Outcome[]
    lastRoundOutcome: Outcome | null
    matchOutcome: Outcome | null
    turn: Competitor | null
    shotsLeft: Record<Competitor, number>
    roundYield: Record<Competitor, number>
    scoreLabel: string | null
    field: Body[]
    decor: FieldDecor | null
}

/** Foto imutável do jogo, entregue à interface a cada mudança. */
export interface MarblesSnapshot {
    playType: PlayType
    multiplayer: MultiplayerSnapshot
    /** `true` antes de uma partida ou sala começar. */
    choosing: boolean
    modeId: ModeId
    opponent: Opponent
    /** Nível do bot escolhido (vale só contra o bot). */
    botLevel: BotLevel
    shotControl: ShotControl
    trackerStatus: MarblesTrackerStatus
    /** Câmera negada, indisponível ou falhou. */
    cameraFailed: boolean
    /** Motivo da falha do detector; `null` quando não há falha. */
    failureReason: string | null
    /** A partida em andamento; `null` enquanto na tela de escolha. */
    match: MatchView | null
    /** Mira em andamento (só na vez do jogador). */
    aim: AimView | null
    /** Próximo tiro do adversário enquanto a prévia curta está visível. */
    opponentIntent: OpponentIntent | null
    /** Posição da pinça no campo e se está fechada; `null` quando a mão não é vista. */
    hand: { point: Vec; closed: boolean } | null
    debug: MarblesDebug
}
