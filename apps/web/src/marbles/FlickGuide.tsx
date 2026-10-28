import { type BeteState, type FlickPhase } from '@guess-my-move/marbles'

import { currentStep } from './flickStep.js'
import { type FlickOutcome } from './marblesController.js'

const STEPS = [
    'Feche a mão, com o polegar preso contra o indicador.',
    'Mire como na pinça: afaste a mão do alvo e a seta mostra para onde a bolinha vai.',
    'Estique o polegar para cima de uma vez e deixe-o esticado.',
    'A bolinha rola. A força vem da rapidez com que o polegar esticou.',
] as const

const HINTS: Partial<Record<FlickOutcome, string>> = {
    'fraco demais':
        'O último estalo ficou fraco: estique o polegar de uma vez, a partir do polegar bem preso.',
    'não sustentado':
        'O polegar voltou cedo: deixe-o esticado até a bolinha sair (cerca de um quarto de segundo).',
    'mão aberta':
        'Parece a mão se abrindo: mantenha o punho fechado e estique só o polegar.',
    'sem mira':
        'Faltou arrasto: afaste mais a mão do alvo, até a seta aparecer, antes de esticar o polegar.',
}

/**
 * Guia do modo estalo: as etapas do movimento, a etapa atual destacada e, depois
 * de um estalo que não disparou, uma dica do que corrigir.
 */
export function FlickGuide({
    state,
    phase,
    lastResult,
}: {
    state: BeteState
    phase: FlickPhase
    lastResult: FlickOutcome | null
}) {
    const step = currentStep({ state, phase })
    const hint = lastResult === null ? undefined : HINTS[lastResult]
    return (
        <div className="flick-guide">
            <ol className="flick-steps" aria-label="Etapas do estalo">
                {STEPS.map((text, index) => (
                    <li
                        key={text}
                        className={step === index + 1 ? 'flick-step flick-step-current' : 'flick-step'}
                        {...(step === index + 1 ? { 'aria-current': 'step' as const } : {})}
                    >
                        {text}
                    </li>
                ))}
            </ol>
            <p className="flick-hint" data-testid="flick-hint" aria-live="polite">
                {hint}
            </p>
        </div>
    )
}
