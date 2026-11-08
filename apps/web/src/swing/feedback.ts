import { type HeadLookMode, type SwingCue } from '@guess-my-move/swing'

import { gripStatusLine, statusLine } from './guide.js'
import { type LookMode, type SwingPhase, type SwingTrackerStatus } from './swingController.js'

/**
 * Mensagens sobre o jogo: estados que duram (chips) e avisos de evento. Funções puras, sem
 * tempo nem DOM; o componente `SwingFeedback` desenha e cuida de quanto cada aviso fica.
 */

/** O que a derivação lê do snapshot do jogo. */
export interface FeedbackInput {
    phase: SwingPhase
    cameraActive: boolean
    lookMode: LookMode
    faceTrackerStatus: SwingTrackerStatus
    faceVisible: boolean
    lockMode: HeadLookMode
    gripped: boolean
    /** Escalar olhando: direção pedida, quanto da espera passou (0 a 1) e se já escala. */
    headClimb: { intent: 'up' | 'down' | null; progress: number; climbing: boolean }
    cue: SwingCue
    /** Mãos com teia presa (-1 esquerda, 0 centro, 1 direita). */
    webSides: readonly (-1 | 0 | 1)[]
}

export type ChipId = 'grip' | 'wall' | 'lock' | 'face'

/** Um estado que dura, mostrado enquanto vale. */
export interface FeedbackChip {
    id: ChipId
    text: string
    tone: 'active' | 'info' | 'warn'
    /** Só na espera de escalar: quanto da espera passou (0 a 1), para a barra. */
    progress?: number
}

const SIDE_NAMES = { '-1': 'esquerda', '0': 'centro', '1': 'direita' } as const

/** O rosto está sendo lido: câmera ativa, modo Rosto e detector pronto. */
const faceWatched = (input: FeedbackInput): boolean =>
    input.cameraActive && input.lookMode === 'face' && input.faceTrackerStatus === 'ready'

/**
 * Estados que duram, do mais importante ao menos: agarre ou dica de parede, direção travada
 * e rosto fora do quadro. Vazia fora do jogo.
 */
export function deriveChips(input: FeedbackInput): FeedbackChip[] {
    if (input.phase !== 'playing') return []
    const chips: FeedbackChip[] = []

    if (input.gripped) {
        const looking = input.lookMode === 'face' && input.faceVisible
        const climb = looking ? input.headClimb : null
        const chip: FeedbackChip = { id: 'grip', text: gripStatusLine(climb), tone: 'active' }
        if (climb && climb.intent && !climb.climbing) chip.progress = climb.progress
        chips.push(chip)
    } else if (input.cue === 'wall') {
        chips.push({ id: 'wall', text: statusLine('wall'), tone: 'info' })
    }

    if (input.lockMode === 'locked') {
        chips.push({ id: 'lock', text: 'Direção travada', tone: 'active' })
    } else if (faceWatched(input) && !input.faceVisible) {
        chips.push({ id: 'face', text: 'Rosto fora do quadro', tone: 'warn' })
    }
    return chips
}

/** Nome das mãos que prenderam: as duas ao mesmo tempo viram "as duas". */
function sidesLabel(sides: readonly (-1 | 0 | 1)[]): string {
    if (sides.includes(-1) && sides.includes(1)) return 'as duas'
    return sides.map((side) => SIDE_NAMES[`${side}`]).join(' e ')
}

/**
 * Avisos pela mudança entre dois estados, na ordem: trava, parede, teia, rosto. Travar e
 * agarrar não geram aviso porque o chip já aparece; só os fins e o que não tem chip.
 */
export function feedbackEvents(prev: FeedbackInput | null, next: FeedbackInput): string[] {
    if (!prev || prev.phase !== 'playing' || next.phase !== 'playing') return []
    const events: string[] = []

    if (prev.lockMode === 'locked' && next.lockMode !== 'locked') events.push('Direção liberada')
    if (prev.gripped && !next.gripped) events.push('Soltou da parede')

    const lost = prev.webSides.filter((side) => !next.webSides.includes(side))
    const added = next.webSides.filter((side) => !prev.webSides.includes(side))
    if (lost.length > 0) events.push('Teia solta')
    if (added.length > 0) events.push(`Teia presa: ${sidesLabel(added)}`)

    if (faceWatched(next) && !prev.faceVisible && next.faceVisible) events.push('Rosto detectado')
    return events
}
