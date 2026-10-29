import { type SwingCue } from '@guess-my-move/swing'

import { type SwingTrackerStatus } from './swingController.js'

/** Etapas do jogo, na ordem. A atual é destacada na tela. */
export const STEPS = [
    'Pose de teia: polegar, indicador e mindinho abertos.',
    'Uma teia por mão: segure uma ou as duas.',
    'Punho fechado puxa. Palma aberta solta.',
    'Solte na subida para voar. Lance de novo.',
] as const

/** Etapa em andamento (1 a 4), a partir da próxima ação do jogador. */
export function currentStep(cue: SwingCue): number {
    switch (cue) {
        case 'swing':
            return 3
        case 'release':
            return 4
        default:
            return 1
    }
}

/** Uma linha com o que fazer agora. */
export function statusLine(cue: SwingCue): string {
    switch (cue) {
        case 'start':
            return 'Faça a pose de teia para saltar.'
        case 'swing':
            return 'Balançando. Punho fechado puxa.'
        case 'release':
            return 'Abra a mão para soltar e voar!'
        case 'low':
            return 'Perto do chão! Lance a teia já.'
        case 'ground':
            return 'No chão. Lance a teia para subir.'
        default:
            return 'Lance a teia em um prédio alto.'
    }
}

export interface HintInput {
    cameraActive: boolean
    trackerStatus: SwingTrackerStatus
    handVisible: boolean
    /** Alguma mão está segurando a pose de teia. */
    gestureHeld: boolean
    /** O jogador está agarrado a uma parede (escalando). */
    gripped: boolean
    lastThrow: 'hit' | 'miss' | null
    cue: SwingCue
}

/** Dica curta do que corrigir agora; vazia quando está tudo certo. */
export function guideHint({
    cameraActive,
    trackerStatus,
    handVisible,
    gestureHeld,
    gripped,
    lastThrow,
    cue,
}: HintInput): string {
    if (trackerStatus === 'error') return 'O detector falhou. Use Espaço, Z, X, C, V e as setas.'
    if (!cameraActive) return 'Sem câmera: Espaço lança, Z e X lançam cada lado (juntos, as duas), C puxa, V agarra na parede, setas olham/sobem.'
    if (gripped) return 'Na parede: mãos abertas, alterne para subir. Puxe a mão para soltar.'
    if (trackerStatus === 'loading') return 'Carregando o detector…'
    if (lastThrow === 'miss') return 'A teia errou. Lance de novo, olhando para a cidade.'
    if (!handVisible) return 'Mostre a mão inteira para a câmera.'
    if (cue === 'release') return 'Palma aberta na subida do arco dá o impulso.'
    if (!gestureHeld && cue !== 'swing') {
        return 'Polegar, indicador e mindinho abertos; médio e anelar dobrados. Vale em qualquer ângulo.'
    }
    return ''
}

/** Linha de status quando o jogador está agarrado à parede. */
export function gripStatusLine(): string {
    return 'Agarrado. Alterne as mãos para subir; puxe para soltar.'
}
