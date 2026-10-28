import { type BeteState, type FlickPhase } from '@guess-my-move/marbles'

/** Etapa (1 a 4) em que o jogador está, ou `null` quando a rodada não está em andamento. */
export function currentStep(input: { state: BeteState; phase: FlickPhase }): 1 | 2 | 3 | 4 | null {
    switch (input.state) {
        case 'ready':
            return 1
        case 'aiming':
            return input.phase === 'pending' ? 3 : 2
        case 'rolling':
        case 'hit':
            return 4
        default:
            return null
    }
}
