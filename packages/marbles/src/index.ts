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
