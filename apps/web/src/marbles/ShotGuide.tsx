import { type FlickPhase, type Mode, type Opponent } from '@guess-my-move/marbles'

import { Steps } from '../design/index.js'
import { STEPS, currentStep, guideHint, rulesText } from './guideSteps.js'
import { type FlickOutcome, type ShotControl } from './marblesController.js'

export interface ShotGuideProps {
    mode: Mode
    modeId: string
    opponent: Opponent
    shotControl: ShotControl
    /** É a vez do jogador e a câmera está pronta. */
    ready: boolean
    /** Há mira em andamento. */
    aiming: boolean
    flickPhase: FlickPhase
    shotReady: boolean
    handVisible: boolean
    lastResult: FlickOutcome | null
}

/**
 * Como jogar: as regras do modo e do adversário (vitória, derrota e empate), as
 * etapas do gesto (a atual destacada por `aria-current`) e uma dica curta do que
 * corrigir. Nenhuma mensagem passa de duas frases.
 */
export function ShotGuide({
    mode,
    modeId,
    opponent,
    shotControl,
    ready,
    aiming,
    flickPhase,
    shotReady,
    handVisible,
    lastResult,
}: ShotGuideProps) {
    const step = currentStep({ shotControl, ready, aiming, flickPhase, shotReady })
    const hint = guideHint({ shotControl, modeId, ready, aiming, handVisible, lastResult })
    return (
        <div className="shot-guide">
            <p className="guide-rules" data-testid="guide-rules">
                {rulesText(mode, opponent)}
            </p>
            <Steps label="Como jogar" items={STEPS[shotControl]} current={step} />
            <p className="guide-hint" data-testid="guide-hint" aria-live="polite">
                {hint}
            </p>
        </div>
    )
}
