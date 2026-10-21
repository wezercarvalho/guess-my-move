import type {
    Card,
    GuesserInput,
    GuesserProvider,
    GuesserResult,
} from '@guess-my-move/core'

/**
 * Carta "Acenar" usada como fixture LOCAL dos testes de fronteira. A carta
 * oficial é responsabilidade do agente do `packages/core`; aqui só precisamos
 * de uma instância com todos os campos do contrato `Card` para provar que
 * NENHUM deles cruza a fronteira do adivinhador.
 */
export const wavingCardFixture: Card = {
    id: 'wave-001',
    locale: 'pt-BR',
    public: {
        word: 'Acenar',
        hint: 'Um gesto de cumprimento à distância.',
        suggestion: 'Levante a mão aberta e balance de lado a lado.',
        difficulty: 'fácil',
    },
    evaluation: {
        canonicalAnswer: 'acenar',
        acceptedAliases: ['dar tchau', 'acenar com a mão'],
        insufficientGuesses: ['levantar a mão', 'mostrar a palma'],
        visualCriteria: ['oscilação lateral do pulso', 'mão acima do ombro'],
    },
}

/**
 * Todos os termos da carta que NUNCA podem aparecer no que é enviado ao
 * provedor: palavra, dica, sugestão, resposta canônica, aliases, palpites
 * insuficientes e critérios de avaliação.
 */
export function forbiddenCardTerms(card: Card): string[] {
    return [
        card.public.word,
        card.public.hint,
        card.public.suggestion,
        ...(card.public.difficulty ? [card.public.difficulty] : []),
        card.evaluation.canonicalAnswer,
        ...card.evaluation.acceptedAliases,
        ...card.evaluation.insufficientGuesses,
        ...(card.evaluation.visualCriteria ?? []),
    ]
}

/**
 * Serializa TUDO que um provedor recebe — a entrada e, quando houver, o prompt
 * e os argumentos realmente passados a um processo externo — para inspeção
 * textual. Normaliza para minúsculas para uma comparação robusta.
 */
export function captureHaystack(parts: unknown[]): string {
    return parts
        .map((part) => {
            if (typeof part === 'string') {
                return part
            }
            try {
                return JSON.stringify(part)
            } catch {
                return String(part)
            }
        })
        .join('\n')
        .toLowerCase()
}

/** Verifica se algum termo proibido aparece no material capturado. */
export function findLeak(haystack: string, terms: string[]): string | null {
    const hay = haystack.toLowerCase()
    for (const term of terms) {
        const needle = term.trim().toLowerCase()
        if (needle.length > 0 && hay.includes(needle)) {
            return term
        }
    }
    return null
}

/**
 * Provedor espião: implementa `GuesserProvider`, captura TUDO que recebe em
 * `seen` e devolve um palpite fixo. Não contata rede nem lê credencial.
 */
export class SpyGuesserProvider implements GuesserProvider {
    readonly id = 'spy'
    readonly seen: { input?: GuesserInput; signalAborted?: boolean } = {}

    guess(input: GuesserInput, signal?: AbortSignal): Promise<GuesserResult> {
        this.seen.input = input
        this.seen.signalAborted = signal?.aborted ?? false
        return Promise.resolve({ guess: 'acenar' })
    }
}

/**
 * Adaptador MUTANTE de teste: injeta a dica da carta no palpite rejeitado
 * enviado ao provedor subjacente. Existe só para PROVAR que o detector de
 * fronteira pega um vazamento; nunca é registrado no servidor real.
 */
export class LeakingGuesserAdapter implements GuesserProvider {
    readonly id = 'leaking'

    constructor(
        private readonly inner: SpyGuesserProvider,
        private readonly card: Card,
    ) {}

    guess(input: GuesserInput, signal?: AbortSignal): Promise<GuesserResult> {
        const leaked: GuesserInput = {
            frames: input.frames,
            rejectedGuesses: [
                ...(input.rejectedGuesses ?? []),
                // Vazamento proposital: a dica da carta não deveria estar aqui.
                this.card.public.hint,
            ],
        }
        return this.inner.guess(leaked, signal)
    }
}
