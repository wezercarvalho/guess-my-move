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
    type BotConfig,
    type BotPlanner,
    DEFAULT_BOT,
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
    type Match,
    type MatchConfig,
    type Mode,
    type NextTurn,
    type Opponent,
    type Outcome,
    type ShotSource,
    computeMatchOutcome,
    createMatch,
} from './match/index.js'
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
export {
    type BeteConfig,
    type BeteRound,
    type BeteSnapshot,
    type BeteState,
    DEFAULT_BETE,
    createBeteRound,
} from './round.js'
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

import { type Mode } from './match/index.js'
import { DEFAULT_BETE_MODE } from './modes/bete/index.js'
import { DEFAULT_TRIANGLE_MODE } from './modes/triangle/index.js'

/** Uma entrada do registro de modos para a interface montar o seletor. */
export interface ModeEntry {
    /** Identificador estável do modo (usado em rota e seletor). */
    id: string
    /** Nome de exibição do modo. */
    name: string
    /** O modo em si (contrato da partida). */
    mode: Mode
}

/**
 * Registro dos modos disponíveis, na ordem de exibição. A interface consome
 * esta lista para montar o seletor de modo da partida.
 */
export const modes: readonly ModeEntry[] = [
    { id: 'bete', name: DEFAULT_BETE_MODE.name, mode: DEFAULT_BETE_MODE },
    { id: 'triangle', name: DEFAULT_TRIANGLE_MODE.name, mode: DEFAULT_TRIANGLE_MODE },
]
