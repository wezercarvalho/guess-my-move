import { type SwingCue } from '@guess-my-move/swing'

import { type SwingTrackerStatus } from './swingController.js'

/** Etapas do jogo, na ordem. A atual é destacada na tela. */
export const STEPS = [
    'Pose de teia: polegar, indicador e mindinho abertos.',
    'Esquerda lança à esquerda, direita à direita, as duas ao centro.',
    'Segure e balance: a corda acelera você.',
    'Solte na subida para voar. Lance de novo.',
] as const

/** Etapa em andamento (1 a 4), a partir da próxima ação do jogador. */
export function currentStep(cue: SwingCue): number {
    switch (cue) {
        case 'start':
            return 1
        case 'swing':
            return 3
        case 'release':
            return 4
        default:
            return 2
    }
}

/** Uma linha com o que fazer agora. */
export function statusLine(cue: SwingCue): string {
    switch (cue) {
        case 'start':
            return 'Faça a pose de teia para saltar.'
        case 'swing':
            return 'Balançando. Segure a pose.'
        case 'release':
            return 'Solte agora para voar!'
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
    lastThrow: 'hit' | 'miss' | null
    cue: SwingCue
}

/** Dica curta do que corrigir agora; vazia quando está tudo certo. */
export function guideHint({
    cameraActive,
    trackerStatus,
    handVisible,
    gestureHeld,
    lastThrow,
    cue,
}: HintInput): string {
    if (trackerStatus === 'error') return 'O detector falhou. Use Espaço, Z, X e as setas.'
    if (!cameraActive) return 'Sem câmera: Espaço lança, Z e X lançam de lado, setas olham.'
    if (trackerStatus === 'loading') return 'Carregando o detector…'
    if (lastThrow === 'miss') return 'A teia errou. Olhe para cima, na direção de um prédio.'
    if (!handVisible) return 'Mostre a mão inteira para a câmera.'
    if (cue === 'release') return 'Soltar na subida do arco dá o impulso.'
    if (!gestureHeld && cue !== 'swing') {
        return 'Polegar, indicador e mindinho abertos; médio e anelar dobrados. Vale em qualquer ângulo.'
    }
    return ''
}
