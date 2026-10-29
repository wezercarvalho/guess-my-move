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
    DEFAULT_BOT,
    type PlanejadorDoBot,
    type Vec2,
    criarPlanejadorDoBot,
    direcaoPara,
    velocidadeParaParar,
} from './bot/index.js'
export {
    type Adversario,
    type Avaliacao,
    type Competidor,
    type ContextoDeAvaliacao,
    DEFAULT_MAX_PASSOS_POR_TIRO,
    type FonteDeTiro,
    type Match,
    type MatchConfig,
    type Modo,
    type ProximaVez,
    type ResultadoDaRodada,
    computarResultadoDaPartida,
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
