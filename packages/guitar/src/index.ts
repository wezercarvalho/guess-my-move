export {
    type Chord,
    type ChordId,
    type FingerNumber,
    FRET_COUNT,
    type FretNumber,
    OPEN_STRING_MIDI,
    STRING_NUMBERS,
    type SoundingString,
    type StringNumber,
    type StringSpec,
    midiOf,
    pitchClassName,
    soundingStrings,
} from './theory.js'
export { CHORDS, CHORD_IDS, chordById } from './chords.js'
export {
    type BoardPlacement,
    type BoardPoint,
    type Cell,
    DEFAULT_PLACEMENT,
    FRET_EDGES,
    type Rect,
    type ScreenPoint,
    cellAt,
    cellBounds,
    fretPosition,
    insideCell,
    insideRect,
    stringV,
    strumZone,
    toBoardPoint,
    toScreenPoint,
} from './board.js'
export { type OneEuroConfig, OneEuroFilter } from './oneEuro.js'
export {
    DEFAULT_SPLIT_MARGIN,
    type HandInput,
    HandRoleAssigner,
    type HandRoles,
} from './hands.js'
export {
    DEFAULT_FINGER_CONFIG,
    type FingerDebug,
    type FingerPress,
    FingerTracker,
    type FingerTrackerConfig,
} from './fingers.js'
export {
    type ChordEvaluation,
    ChordStability,
    type ChordStabilityConfig,
    type Correction,
    DEFAULT_STABILITY_CONFIG,
    type EvaluateOptions,
    type StringEvaluation,
    type StringState,
    evaluateChord,
} from './evaluate.js'
export {
    DEFAULT_STRUM_CONFIG,
    StrumDetector,
    type StrumConfig,
    type StrumEvent,
    type StrumSample,
} from './strum.js'
export { type PluckOptions, midiToFrequency, synthPluck } from './synth.js'
export {
    DEFAULT_STRUM_PLAN,
    type PlannedNote,
    type StrumPlanConfig,
    planStrum,
} from './strumPlan.js'
