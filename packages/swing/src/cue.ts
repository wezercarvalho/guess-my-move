import { type SwingState } from './physics.js'

/**
 * O que o jogador deve fazer agora: começar, continuar balançando, soltar a teia para
 * voar, lançar outra, correr para lançar antes de cair, subir do chão, agarrar a parede
 * encostada, ou escalar quando já agarrado.
 */
export type SwingCue = 'start' | 'swing' | 'release' | 'throw' | 'low' | 'ground' | 'wall' | 'grip'

/** Abaixo desta altura, sem teia, o jogador está perto de cair, em metros. */
const LOW_ALTITUDE = 30
/** Subindo mais rápido que isto, em m/s, a corda já fez o arco de baixo. */
const RISING = 1
/** Velocidade horizontal mínima, em m/s, para valer a pena soltar. */
const FAST = 12

/**
 * Lê o estado e diz qual é o próximo gesto. Soltar a teia na subida do arco, com
 * velocidade, é o que lança o jogador para longe. Agarrado à parede, orienta a escalada;
 * encostado numa parede sem teia e sem agarre, orienta a agarrar.
 */
export function swingCue(
    state: Pick<SwingState, 'started' | 'webs' | 'velocity' | 'position' | 'grounded' | 'grip' | 'touchingWall'>,
): SwingCue {
    if (!state.started) return 'start'
    if (state.grip !== null) return 'grip'
    if (state.webs.length > 0) {
        const horizontal = Math.hypot(state.velocity.x, state.velocity.z)
        return state.velocity.y > RISING && horizontal >= FAST ? 'release' : 'swing'
    }
    if (state.touchingWall) return 'wall'
    if (state.grounded) return 'ground'
    return state.position.y < LOW_ALTITUDE ? 'low' : 'throw'
}
