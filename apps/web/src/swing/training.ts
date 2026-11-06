import { createOnlineTrainingCity } from '@guess-my-move/swing'
import { type City, type WebSide } from '@guess-my-move/swing'
import { type CityMap } from './cityCatalog.js'

export const TRAINING_MAP: CityMap = {
    id: 'aurora', name: 'Aurora', region: 'Cenário de treino',
    description: 'Explore torres de néon e aprenda os comandos no seu ritmo.',
    file: 'swing/aurora.json', spawnHeight: 90,
    attribution: 'Aurora · cenário procedural local do Guess My Move',
}

/** Mesma pegada da colisão v1: plataformas caminháveis são telhados. */
export function createTrainingCity(): City {
    return createOnlineTrainingCity()
}

export const TRAINING_EXERCISES = [
    ['left', 'Lançar a teia esquerda'], ['right', 'Lançar a teia direita'],
    ['pull', 'Puxar uma teia com o punho fechado'], ['release', 'Soltar a teia com a palma aberta'],
    ['grab', 'Agarrar uma parede com a mão aberta'], ['climb', 'Escalar olhando para cima ou para baixo'],
    ['lock', 'Travar a direção do olhar com o dedão para baixo'],
] as const
export type TrainingExercise = typeof TRAINING_EXERCISES[number][0]
export type TrainingProgress = Readonly<Record<TrainingExercise, boolean>> & { readonly attached: boolean }
export const EMPTY_TRAINING: TrainingProgress = {
    left: false, right: false, pull: false, release: false, grab: false, climb: false, lock: false, attached: false,
}
export interface TrainingObservation {
    webSides: readonly WebSide[]
    pulling: boolean
    gripped: boolean
    headClimbing: boolean
    locked: boolean
    released: boolean
}
/** Observa resultados reais do mundo a cada quadro, antes do throttle de publicação do HUD. */
export function advanceTraining(previous: TrainingProgress, observation: TrainingObservation): TrainingProgress {
    const attached = observation.webSides.length > 0
    return {
        left: previous.left || observation.webSides.includes(-1),
        right: previous.right || observation.webSides.includes(1),
        pull: previous.pull || (attached && observation.pulling),
        release: previous.release || (previous.attached && !attached && observation.released && !observation.gripped),
        grab: previous.grab || observation.gripped,
        climb: previous.climb || (observation.gripped && observation.headClimbing),
        lock: previous.lock || observation.locked,
        attached,
    }
}
