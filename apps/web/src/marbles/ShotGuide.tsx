import { type BeteState, type FlickPhase } from '@guess-my-move/marbles'

import { Steps } from '../design/index.js'
import { STEPS, currentStep, guideHint } from './guideSteps.js'
import { type FlickOutcome, type MarblesMode } from './marblesController.js'

export interface ShotGuideProps {
    mode: MarblesMode
    state: BeteState
    phase: FlickPhase
    shotReady: boolean
    handVisible: boolean
    lastResult: FlickOutcome | null
}

/** Como jogar: as etapas do modo (a atual destacada) e uma dica curta do que corrigir. */
export function ShotGuide({ mode, state, phase, shotReady, handVisible, lastResult }: ShotGuideProps) {
    const step = currentStep({ mode, state, phase, shotReady })
    const hint = guideHint({ mode, state, handVisible, lastResult })
    return (
        <div className="shot-guide">
            <Steps label="Como jogar" items={STEPS[mode]} current={step} />
            <p className="guide-hint" data-testid="guide-hint" aria-live="polite">
                {hint}
            </p>
        </div>
    )
}
