/**
 * Filtro do gesto de travar a direção do olhar (mão aberta, dedão para baixo). Só vale
 * depois da pose mantida por `onsetMs`, para um gesto passageiro não travar, e só deixa de
 * valer depois de `releaseGraceMs` sem a pose, para um quadro ruim da câmera não soltar.
 * Lógica pura, sem navegador nem câmera. Os tempos são valores de jogo, não medidos.
 */

export interface LockGestureConfig {
    /** Tempo, em ms, com a pose antes de travar. */
    onsetMs: number
    /** Tempo, em ms, sem a pose antes de soltar a trava. */
    releaseGraceMs: number
}

export const DEFAULT_LOCK_GESTURE: LockGestureConfig = {
    onsetMs: 200,
    releaseGraceMs: 150,
}

export interface LockGesture {
    /** Um quadro: a pose está presente agora? Devolve se a trava vale. */
    update(present: boolean, dtMs: number): boolean
    /** Volta ao estado inicial (sem trava e sem contagem). */
    reset(): void
}

export function createLockGesture(config: LockGestureConfig = DEFAULT_LOCK_GESTURE): LockGesture {
    let held = false
    let presentMs = 0
    let absentMs = 0

    return {
        update(present, dtMs) {
            if (present) {
                absentMs = 0
                if (!held) {
                    presentMs += dtMs
                    if (presentMs >= config.onsetMs) held = true
                }
            } else if (held) {
                absentMs += dtMs
                if (absentMs > config.releaseGraceMs) {
                    held = false
                    presentMs = 0
                    absentMs = 0
                }
            } else {
                presentMs = 0
            }
            return held
        },
        reset() {
            held = false
            presentMs = 0
            absentMs = 0
        },
    }
}
