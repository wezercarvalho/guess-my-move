export {
    type AimConfig,
    type AimController,
    type AimInProgress,
    type AimKind,
    type AimOutcome,
    type AimVec,
    DEFAULT_AIM,
    createAimController,
} from './aim/index.js'
export {
    DEFAULT_FLICK,
    type FlickConfig,
    type FlickDetector,
    type FlickPhase,
    type FlickReading,
    type FlickRelease,
    type FlickPower,
    type FlickVerdict,
    type HandGesture,
    createFlickDetector,
    flickPower,
} from './flick.js'
export {
    BOT_LEVELS,
    type BotConfig,
    type BotLevel,
    type BotPlanner,
    DEFAULT_BOT,
    DEFAULT_BOT_LEVEL,
    type Vec2,
    createBotPlanner,
    directionTo,
    speedToStop,
} from './bot/index.js'
export {
    type Competitor,
    DEFAULT_MAX_STEPS_PER_SHOT,
    type Evaluation,
    type EvaluationContext,
    type FieldDecor,
    type Match,
    type MatchConfig,
    type Mode,
    type Opponent,
    type Outcome,
    type ShotSource,
    computeMatchOutcome,
    createMatch,
} from './match/index.js'
export {
    type MatchPhase,
    type MatchSession,
    type MatchSessionConfig,
    type MatchSnapshot,
    createMatchSession,
} from './match/session.js'
export {
    type Body,
    DEFAULT_PHYSICS,
    type PhysicsConfig,
    type StepResult,
    type Vec,
    isAtRest,
    stepBodies,
} from './physics.js'
export {
    DEFAULT_PINCH,
    type PinchConfig,
    type PinchDetector,
    type PinchReading,
    type Point,
    createPinchDetector,
    pinchRatio,
} from './pinch.js'
export { DEFAULT_SHOT, type Shot, type ShotConfig, computeShot } from './shot.js'
export {
    type BeteConfig as BeteModeConfig,
    DEFAULT_BETE_CONFIG,
    DEFAULT_BETE_MODE,
    createBeteMode,
} from './modes/bete/index.js'
export {
    DEFAULT_TRIANGLE_CONFIG,
    DEFAULT_TRIANGLE_MODE,
    type TriangleConfig,
    type TriangleMode,
    createTriangleMode,
    triangleBotAimPoint,
} from './modes/triangle/index.js'
export {
    DEFAULT_HOLE_CONFIG,
    DEFAULT_HOLE_MODE,
    type HoleConfig,
    type HoleMode,
    type HoleProgress,
    createHoleMode,
} from './modes/hole/index.js'

import { type Competitor, type Mode } from './match/index.js'
import { type Body, type Vec } from './physics.js'
import { DEFAULT_BETE_MODE, createBeteMode } from './modes/bete/index.js'
import {
    DEFAULT_TRIANGLE_MODE,
    DEFAULT_TRIANGLE_CONFIG,
    createTriangleMode,
    triangleBotAimPoint,
} from './modes/triangle/index.js'
import { DEFAULT_HOLE_MODE, createHoleMode, type HoleMode } from './modes/hole/index.js'

/**
 * Ponto de chegada do tiro do bot num modo, dado o campo preparado e de quem é a
 * vez. `null` quando não há alvo (o chamador escolhe um tiro de reserva). A
 * geometria do modo vive aqui, não no controlador da tela.
 */
export type BotAimPoint = (field: readonly Body[], competitor: Competitor) => Vec | null

/** Uma entrada do registro de modos para a interface montar o seletor. */
export interface ModeEntry {
    /** Identificador estável do modo (usado em rota e seletor). */
    id: string
    /** Nome de exibição do modo. */
    name: string
    /** Cria uma instância nova do modo (estado por rodada próprio de cada partida). */
    create: () => Mode
    /** Onde o bot mira neste modo; o planejador transforma em tiro. */
    botAimPoint: (mode: Mode) => BotAimPoint
}

/**
 * Registro dos modos disponíveis, na ordem de exibição. A interface consome
 * esta lista para montar o seletor de modo da partida. Cada partida pede uma
 * instância nova por `create()`, para não compartilhar o estado por rodada.
 */
export const modes: readonly ModeEntry[] = [
    {
        id: 'bete',
        name: DEFAULT_BETE_MODE.name,
        create: () => createBeteMode(),
        // Bete: o alvo é o segundo corpo do campo.
        botAimPoint: () => (field) => (field.length > 1 ? { ...field[1].pos } : null),
    },
    {
        id: 'triangle',
        name: DEFAULT_TRIANGLE_MODE.name,
        create: () => createTriangleMode(),
        // Triângulo: a bolinha de dentro mais próxima da borda.
        botAimPoint: () => (field) => triangleBotAimPoint(field, DEFAULT_TRIANGLE_CONFIG),
    },
    {
        id: 'hole',
        name: DEFAULT_HOLE_MODE.name,
        create: () => createHoleMode(),
        // Cova: o centro da cova ativa do competidor da vez.
        botAimPoint: (mode) => (_field, competitor) => (mode as HoleMode).botAimPoint(competitor),
    },
]
