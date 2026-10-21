/**
 * Carta inicial do jogo: "Acenar". Versionada no Git como dado TypeScript
 * (sem banco). Os textos seguem a seção 5 do `PROJECT_SPEC.md`.
 *
 * Adicionar uma nova carta é só acrescentar outro objeto `Card` ao baralho —
 * o motor, o árbitro e a validação funcionam sem nenhuma alteração.
 */
import type { Card } from '../contracts.js'
import { parseCard } from './schema.js'

/**
 * Carta "Acenar". `public` é o que o jogador vê; `evaluation` é privado do
 * servidor/motor e NUNCA vai ao adivinhador.
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
        canonicalAnswer: 'acenar',
        acceptedAliases: ['dar tchau', 'acenando', 'waving', 'waving goodbye'],
        insufficientGuesses: [
            'levantar a mão',
            'mexer o braço',
            'mexer os braços',
            'cumprimentar alguém',
        ],
        visualCriteria: [
            'Uma das mãos aparece levantada.',
            'Há deslocamento lateral repetido da mão ao longo do tempo.',
        ],
    },
})
