/**
 * Carta inicial do jogo: "Acenar". Versionada no Git como dado TypeScript
 * (sem banco). Os textos públicos seguem o `PROJECT_SPEC.md`; a avaliação é o
 * critério de oscilação do ângulo da mão aplicado pelo árbitro por visão.
 *
 * Adicionar uma nova carta é só acrescentar outro objeto `Card` ao baralho; um
 * novo tipo de critério exige ampliar o schema.
 */
import type { Card } from '../contracts.js'
import { parseCard } from './schema.js'

/**
 * Carta "Acenar". `public` é o que o jogador vê; `evaluation` é privado do
 * motor e NUNCA vai ao jogador nem a uma IA jogadora.
 */
export const acenarCard: Card = parseCard({
    id: 'wave-001',
    locale: 'pt-BR',
    public: {
        word: 'Acenar',
        hint: 'Um gesto usado para cumprimentar ou se despedir de alguém à distância.',
        suggestion: 'Levante uma das mãos e movimente-a de um lado para o outro.',
        difficulty: 'easy',
    },
    evaluation: {
        criterion: {
            kind: 'hand-angle-oscillation',
            // Valores iniciais confirmados no spike com 12 clipes (ver research.md
            // da spec): ajustar aqui, na carta, sem mudar o código do avaliador.
            amplitudeDeg: 15,
            minReversals: 3,
            windowMs: 2500,
            minSamples: 5,
        },
    },
})
