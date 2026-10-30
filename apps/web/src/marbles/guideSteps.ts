import { type FlickPhase, type Mode, type Opponent } from '@guess-my-move/marbles'

import { type FlickOutcome, type ShotControl } from './marblesController.js'

/** Etapas do movimento em cada controle de tiro. */
export const STEPS: Record<ShotControl, readonly string[]> = {
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

export interface StepInput {
    shotControl: ShotControl
    /** `true` quando é a vez do jogador e a câmera está pronta para mirar. */
    ready: boolean
    /** `true` enquanto o jogador está mirando (há mira em andamento). */
    aiming: boolean
    /** Etapa do detector de estalo (sem efeito na pinça). */
    flickPhase: FlickPhase
    /** Pinça: o arrasto já vale um tiro (próxima ação: abrir os dedos). */
    shotReady: boolean
}

/** Etapa (1 a 3) em que o jogador está, ou `null` fora da mira. */
export function currentStep({ shotControl, ready, aiming, flickPhase, shotReady }: StepInput): 1 | 2 | 3 | null {
    if (!aiming) return ready ? 1 : null
    if (shotControl === 'flick') return flickPhase === 'pending' ? 3 : 2
    return shotReady ? 3 : 2
}

/** Regras curtas do modo para o adversário escolhido (no máximo 2 frases). */
export function rulesText(mode: Mode, opponent: Opponent): string {
    return mode.rules ? mode.rules[opponent] : mode.helpText
}

const FLICK_HINTS: Partial<Record<FlickOutcome, string>> = {
    'fraco demais': 'Fraco: estique o polegar de uma vez.',
    'não sustentado': 'Segure o polegar esticado até a bolinha sair.',
    'mão aberta': 'Mantenha o punho: estique só o polegar.',
    'sem mira': 'Sem mira: afaste mais a mão do alvo antes de estalar.',
}

/** Dica específica de um modo, quando um resultado do estalo sugere corrigir a força. */
const MODE_HINTS: Record<string, Partial<Record<FlickOutcome, string>>> = {
    hole: {
        'fraco demais': 'Bola fraca: puxe mais para chegar na cova.',
    },
}

export interface HintInput {
    shotControl: ShotControl
    modeId: string
    /** `true` quando é a vez do jogador e a câmera está pronta. */
    ready: boolean
    aiming: boolean
    handVisible: boolean
    lastResult: FlickOutcome | null
}

/** Dica curta do que corrigir agora, ou `null` quando não há o que dizer. */
export function guideHint({
    shotControl,
    modeId,
    ready,
    aiming,
    handVisible,
    lastResult,
}: HintInput): string | null {
    if (ready && !aiming && !handVisible) {
        return 'Palma para a câmera, na altura do peito, com boa luz.'
    }
    if (shotControl !== 'flick' || lastResult === null) return null
    if (!ready && !aiming) return null
    return MODE_HINTS[modeId]?.[lastResult] ?? FLICK_HINTS[lastResult] ?? null
}
