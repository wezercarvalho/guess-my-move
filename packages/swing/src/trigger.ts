/** Gesto pronto reconhecido num quadro (nome da categoria do MediaPipe e pontuação). */
export interface TriggerGesture {
    name: string
    score: number
}

export interface WebTriggerConfig {
    /** Categoria do gesto que lança a teia. */
    gesture: string
    /** Pontuação mínima para contar o quadro. */
    minScore: number
    /** Quadros seguidos com o gesto para lançar. */
    confirmFrames: number
    /** Tempo sem o gesto, em ms, antes de soltar (tolerância a falhas do reconhecedor). */
    releaseMs: number
}

export const DEFAULT_TRIGGER: WebTriggerConfig = {
    gesture: 'ILoveYou',
    minScore: 0.7,
    confirmFrames: 2,
    releaseMs: 250,
}

export interface WebTrigger {
    /** Informa o gesto do quadro (`null` sem mão) e devolve se a teia deve estar presa. */
    update(gesture: TriggerGesture | null, nowMs: number): boolean
    reset(): void
}

/**
 * Transforma o gesto por quadro num sinal estável de "segurar a teia": confirma por
 * alguns quadros antes de lançar e só solta depois de uma pausa curta sem o gesto.
 */
export function createWebTrigger(config: WebTriggerConfig = DEFAULT_TRIGGER): WebTrigger {
    let streak = 0
    let held = false
    let lastSeenMs = 0
    return {
        update(gesture, nowMs) {
            if (gesture !== null && gesture.name === config.gesture && gesture.score >= config.minScore) {
                streak++
                lastSeenMs = nowMs
                if (streak >= config.confirmFrames) held = true
            } else {
                streak = 0
                if (held && nowMs - lastSeenMs > config.releaseMs) held = false
            }
            return held
        },
        reset() {
            streak = 0
            held = false
            lastSeenMs = 0
        },
    }
}
