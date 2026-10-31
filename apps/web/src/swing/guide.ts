import { DEFAULT_HEAD_CLIMB, type HeadLookMode, type SwingCue } from '@guess-my-move/swing'

import { type SwingTrackerStatus } from './swingController.js'

/** Etapas do jogo, na ordem. A atual é destacada na tela. */
export const STEPS = [
    'Pose de teia: polegar, indicador e mindinho abertos.',
    'Uma teia por mão: segure uma ou as duas.',
    'Punho fechado puxa. Palma aberta solta.',
    'Solte na subida para voar. Lance de novo.',
    'Na parede: abra a mão para agarrar. Olhe 2 s para cima ou baixo para escalar.',
] as const

/** Um grupo de teclas e o que ele faz, para a legenda de teclado da tela. */
export interface KeyGroup {
    /** Teclas do grupo (renderizadas como `<kbd>`). */
    keys: readonly string[]
    /** O que o grupo faz, em texto curto. */
    action: string
}

/**
 * Legenda de teclado do Arranha-Teia, como DADOS (uma linha por grupo), para a tela montar a
 * lista e outro PR acrescentar linhas sem conflito de layout. Texto curto e objetivo.
 */
export const KEYS: readonly KeyGroup[] = [
    { keys: ['Espaço'], action: 'lança (centro)' },
    { keys: ['Z', 'X'], action: 'lançam esquerda / direita' },
    { keys: ['C'], action: 'puxa' },
    { keys: ['←', '→', '↑', '↓'], action: 'olham' },
    { keys: ['V'], action: 'agarra a parede (segure, encostado)' },
    { keys: ['↑', '↓'], action: 'sobem / descem agarrado' },
]

/** Etapa em andamento (1 a 5), a partir da próxima ação do jogador. */
export function currentStep(cue: SwingCue): number {
    switch (cue) {
        case 'swing':
            return 3
        case 'release':
            return 4
        case 'wall':
        case 'grip':
            return 5
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
        case 'wall':
            return 'Parede: abra a mão para agarrar.'
        case 'grip':
            return 'Agarrado. Desça uma mão por vez para subir. Punho solta.'
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
    if (gripped) {
        if (!handVisible) return 'Mostre a palma de novo para seguir agarrado.'
        return 'Desça uma mão por vez para subir; as duas sobem para descer. Punho fechado solta.'
    }
    if (trackerStatus === 'loading') return 'Carregando o detector…'
    if (lastThrow === 'miss') return 'A teia errou. Lance de novo, olhando para a cidade.'
    if (!handVisible) return 'Mostre a mão inteira para a câmera.'
    if (cue === 'wall') return 'Encostado na parede: abra a mão para agarrar e escalar.'
    if (cue === 'release') return 'Palma aberta na subida do arco dá o impulso.'
    if (!gestureHeld && cue !== 'swing') {
        return 'Polegar, indicador e mindinho abertos; médio e anelar dobrados. Vale em qualquer ângulo.'
    }
    return ''
}

export interface HeadStatusInput {
    cameraActive: boolean
    faceTrackerStatus: SwingTrackerStatus
    /** Há rosto à vista agora. */
    faceVisible: boolean
    /** Trava da direção (CQ-012): seguindo a cabeça ou travada pelo gesto. */
    lockMode?: HeadLookMode
}

/** Dica de uma linha do painel "Direção do olhar" quando tudo está certo: ensina o gesto de travar. */
export const HEAD_IDLE_HINT = 'Vire a cabeça para olhar. Mão aberta com o dedão para baixo trava a direção.'

/**
 * Status de uma linha da câmera pela cabeça; vazia quando está tudo certo (rosto à vista)
 * ou quando o recurso não está ativo (sem câmera / detector de rosto parado).
 */
export function headStatusLine({
    cameraActive,
    faceTrackerStatus,
    faceVisible,
    lockMode = 'following',
}: HeadStatusInput): string {
    if (!cameraActive || faceTrackerStatus === 'idle') return ''
    if (faceTrackerStatus === 'error') return 'Cabeça indisponível. Use as setas para olhar em volta.'
    if (faceTrackerStatus === 'loading') return 'Carregando o detector de rosto…'
    // Travada, perder o rosto não muda o olhar: o texto da trava vale.
    if (lockMode === 'locked') return 'Direção travada. Tire a mão e olhe para a tela.'
    if (!faceVisible) return 'Rosto fora do quadro. Centralize a cabeça.'
    return ''
}

/** O que o olhar de escalada está fazendo, para a linha de status (`null`: sem rosto/modo Rosto). */
export interface GripHeadClimb {
    intent: 'up' | 'down' | null
    /** Quanto da espera já passou (0 a 1). */
    progress: number
    climbing: boolean
}

/**
 * Linha de status quando o jogador está agarrado à parede. Com o rosto à vista (modo Rosto),
 * ensina e mostra o olhar de escalada: esperando, quanto falta; escalando, como parar.
 */
export function gripStatusLine(head: GripHeadClimb | null = null): string {
    if (!head) return statusLine('grip')
    const seconds = Math.round(DEFAULT_HEAD_CLIMB.dwellMs / 1000)
    if (head.climbing) {
        return `${head.intent === 'down' ? 'Descendo' : 'Subindo'}. Olhe para o lado para parar.`
    }
    if (head.intent) {
        const left = ((1 - head.progress) * DEFAULT_HEAD_CLIMB.dwellMs) / 1000
        const direction = head.intent === 'up' ? 'cima' : 'baixo'
        return `Olhando para ${direction}… ${left.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s`
    }
    return `Agarrado. Olhe ${seconds} s para cima ou para baixo para escalar.`
}
