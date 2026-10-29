/** Gesto pronto reconhecido num quadro (nome da categoria do MediaPipe e pontuação). */
export interface TriggerGesture {
    name: string
    score: number
}

export interface WebTriggerConfig {
    /** Gesto que lança a teia. */
    launch: string
    /** Gestos que mantêm a teia presa depois de lançada. */
    hold: readonly string[]
    /** Gesto que puxa (impulso) com a teia presa. */
    pull: string
    /** Gesto que solta a teia. */
    release: string
    /** Pontuação mínima para contar o quadro. */
    minScore: number
    /** Quadros seguidos com a pose para lançar. */
    confirmFrames: number
    /** Quadros seguidos com a palma aberta para soltar. */
    releaseFrames: number
    /** Tempo, em ms, que a teia aguenta sem a pose nem o punho (falha do reconhecedor, mão no meio do caminho). */
    graceMs: number
}

export const DEFAULT_TRIGGER: WebTriggerConfig = {
    launch: 'ILoveYou',
    hold: ['ILoveYou', 'Closed_Fist'],
    pull: 'Closed_Fist',
    release: 'Open_Palm',
    minScore: 0.7,
    confirmFrames: 2,
    releaseFrames: 2,
    graceMs: 600,
}

export interface WebTriggerState {
    /** A teia deve estar presa. */
    held: boolean
    /** O punho está fechado com a teia presa: puxar. */
    pull: boolean
}

export interface WebTrigger {
    /** Informa o gesto do quadro (`null` sem mão) e devolve o estado da teia. */
    update(gesture: TriggerGesture | null, nowMs: number): WebTriggerState
    reset(): void
}

/**
 * Transforma o gesto por quadro no estado da teia. A pose de teia lança (confirmada por
 * alguns quadros); depois de lançada, a pose e o punho a mantêm presa e o punho puxa. A
 * palma aberta solta. Sem a pose nem o punho por um tempo, a teia solta sozinha.
 */
export function createWebTrigger(config: WebTriggerConfig = DEFAULT_TRIGGER): WebTrigger {
    let launchStreak = 0
    let releaseStreak = 0
    let held = false
    let lastHoldMs = 0
    return {
        update(gesture, nowMs) {
            const name = gesture !== null && gesture.score >= config.minScore ? gesture.name : null
            let pull = false
            if (!held) {
                launchStreak = name === config.launch ? launchStreak + 1 : 0
                if (launchStreak >= config.confirmFrames) {
                    held = true
                    lastHoldMs = nowMs
                    releaseStreak = 0
                }
            } else if (name === config.release) {
                releaseStreak++
                if (releaseStreak >= config.releaseFrames) {
                    held = false
                    launchStreak = 0
                    releaseStreak = 0
                }
            } else {
                releaseStreak = 0
                if (name !== null && config.hold.includes(name)) {
                    lastHoldMs = nowMs
                    pull = name === config.pull
                } else if (nowMs - lastHoldMs > config.graceMs) {
                    held = false
                    launchStreak = 0
                }
            }
            return { held, pull: held && pull }
        },
        reset() {
            launchStreak = 0
            releaseStreak = 0
            held = false
            lastHoldMs = 0
        },
    }
}
