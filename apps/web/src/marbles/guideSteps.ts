import { type BeteState, type FlickPhase } from '@guess-my-move/marbles'

import { type FlickOutcome, type MarblesMode } from './marblesController.js'

/** Etapas do movimento em cada modo de tiro. */
export const STEPS: Record<MarblesMode, readonly string[]> = {
    pinch: [
        'Feche a pinça: polegar e indicador juntos.',
        'Afaste a mão do alvo. A seta mostra o tiro.',
        'Abra os dedos para atirar.',
    ],
    flick: [
        'Feche a mão, polegar preso no indicador.',
        'Afaste a mão do alvo. A seta mostra o tiro.',
        'Estique o polegar e segure.',
    ],
}

export interface GuideInput {
    mode: MarblesMode
    state: BeteState
    /** Etapa do detector de estalo (sem efeito na pinça). */
    phase: FlickPhase
    /** Pinça: o arrasto já vale um tiro (próxima ação: abrir os dedos). */
    shotReady: boolean
}

/** Etapa (1 a 3) em que o jogador está, ou `null` fora da mira. */
export function currentStep({ mode, state, phase, shotReady }: GuideInput): 1 | 2 | 3 | null {
    if (state === 'ready') return 1
    if (state !== 'aiming') return null
    if (mode === 'flick') return phase === 'pending' ? 3 : 2
    return shotReady ? 3 : 2
}

const FLICK_HINTS: Partial<Record<FlickOutcome, string>> = {
    'fraco demais': 'Fraco: estique o polegar de uma vez.',
    'não sustentado': 'Segure o polegar esticado até a bolinha sair.',
    'mão aberta': 'Mantenha o punho: estique só o polegar.',
    'sem mira': 'Sem mira: afaste mais a mão do alvo antes de estalar.',
}

export interface HintInput {
    mode: MarblesMode
    state: BeteState
    handVisible: boolean
    lastResult: FlickOutcome | null
}

/** Dica curta do que corrigir agora, ou `null` quando não há o que dizer. */
export function guideHint({ mode, state, handVisible, lastResult }: HintInput): string | null {
    if (state === 'ready' && !handVisible) return 'Palma para a câmera, na altura do peito, com boa luz.'
    if (mode !== 'flick' || lastResult === null) return null
    if (state !== 'ready' && state !== 'aiming') return null
    return FLICK_HINTS[lastResult] ?? null
}
