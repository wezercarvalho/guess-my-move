import { type SwingTrackerStatus } from './swingController.js'

/** Etapas do jogo, na ordem. A atual é destacada na tela. */
export const STEPS = [
    'Mova a mão para olhar em volta.',
    'Faça o gesto “eu te amo” para lançar a teia.',
    'Desfaça o gesto para soltar e voar.',
] as const

/** Etapa em andamento (1 a 3): lançar a teia, ou soltá-la quando já está presa. */
export function currentStep(webAttached: boolean): number {
    return webAttached ? 3 : 2
}

export interface HintInput {
    cameraActive: boolean
    trackerStatus: SwingTrackerStatus
    handVisible: boolean
    lastThrow: 'hit' | 'miss' | null
}

/** Dica curta do que corrigir agora; vazia quando está tudo certo. */
export function guideHint({ cameraActive, trackerStatus, handVisible, lastThrow }: HintInput): string {
    if (trackerStatus === 'error') return 'O detector falhou. Use Espaço e as setas.'
    if (!cameraActive) return 'Sem câmera, Espaço lança a teia e as setas olham.'
    if (trackerStatus === 'loading') return 'Carregando o detector…'
    if (lastThrow === 'miss') return 'A teia errou. Olhe para cima, na direção de um prédio.'
    if (!handVisible) return 'Mostre a mão inteira para a câmera.'
    return ''
}
