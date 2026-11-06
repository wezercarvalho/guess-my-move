import type {
    City,
    HandMetrics,
    HeadLookMode,
    SwingConfig,
    SwingCue,
    WebSide,
} from '@guess-my-move/swing'
import type { CreateHandTracker } from '../tracker/handTracker.js'
import type { CreateFaceTracker } from '../tracker/faceTracker.js'
import type { CreateSwingRenderer } from './cityRenderer.js'
import type { SwingOnlineBridge } from './multiplayerClient.js'
import type { TrainingProgress } from './training.js'

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
    /** Agarrado a uma parede (escalando). */
    gripped: boolean
    /** O primeiro gesto de teia já aconteceu; antes disso o jogador espera no início. */
    started: boolean
}

/** Dependências do controlador; em testes, a cidade, o 3D, o relógio e as teclas são simulados. */
export interface SwingEnv {
    online?: SwingOnlineBridge
    createTracker: CreateHandTracker
    /** Valores de jogo ajustáveis por mapa (ex.: altura inicial); ausente usa o padrão. */
    config?: SwingConfig
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
    /** Palma aberta (candidata a agarrar a parede). */
    openPalm: boolean
    /** Punho fechado (pedido de soltar a parede quando agarrado). */
    fist: boolean
    /** Mão aberta com o dedão para baixo (gesto de travar a direção do olhar). */
    lockPose: boolean
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
    /** Escalar olhando: direção pedida e quanto da espera passou (0 a 1). */
    climbIntent: 'up' | 'down' | null
    climbProgress: number
    /** Trava da direção: seguindo a cabeça ou travada pelo gesto. */
    lockMode: HeadLookMode
    /** Há uma mão no gesto de travar neste quadro (antes do filtro de tempo). */
    lockPose: boolean
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
    /** Agarre, para a depuração: em contato com a parede, agarrado e o sinal de escalada (-1..1). */
    grabDebug: { touchingWall: boolean; gripped: boolean; climb: number }
    /** Leitura da cabeça, para o painel de depuração. */
    headDebug: HeadDebug
    /** Escalar olhando: para onde o olhar pede (esperando ou escalando), a espera (0 a 1) e se já escala. */
    headClimb: {
        intent: 'up' | 'down' | null
        progress: number
        climbing: boolean
    }
    /** Trava da direção do olhar: seguindo a cabeça ou travada pelo gesto. */
    headLock: { mode: HeadLookMode }
    /** O próximo gesto a fazer, para as dicas da tela. */
    cue: SwingCue
    /** Resultado do último lançamento: prendeu, errou, ou `null` antes do primeiro. */
    lastThrow: 'hit' | 'miss' | null
    hud: SwingHud
    attribution: string
    training: TrainingProgress
}
