import {
    CHORD_IDS,
    type Chord,
    type ChordEvaluation,
    type ChordId,
    type Correction,
    STRING_NUMBERS,
} from '@guess-my-move/guitar'

import { type AudioStatus } from './audioPlayer.js'
import { type GuitarTrackerStatus } from './guitarController.js'

/** O que os textos da tela precisam saber do estado do jogo. */
export interface GuideInput {
    cameraActive: boolean
    trackerStatus: GuitarTrackerStatus
    trackerFailure: string | null
    fretVisible: boolean
    strumVisible: boolean
    leftHanded: boolean
    chord: ChordId
    evaluation: ChordEvaluation
    stable: boolean
    completed: readonly ChordId[]
    audioStatus: AudioStatus
}

/** As três etapas do guia "Como jogar". */
export const STEPS: readonly string[] = [
    'Posicione as mãos',
    'Forme o acorde',
    'Bata para tocar',
]

/** Uma frase curta para a única correção: dedo, corda e casa. */
export function correctionText(correction: Correction): string {
    switch (correction.action) {
        case 'place':
            return `Coloque o dedo ${correction.finger} na corda ${correction.string}, casa ${correction.fret}.`
        case 'move':
            return `Mova o dedo ${correction.finger} para a casa ${correction.fret} da corda ${correction.string}.`
        case 'remove':
            return `Tire o dedo ${correction.finger} da corda ${correction.string}.`
    }
}

/** O próximo acorde da ordem de ensino que ainda não foi concluído, ou `null` se todos foram. */
export function nextChord(current: ChordId, completed: readonly ChordId[]): ChordId | null {
    const start = CHORD_IDS.indexOf(current)
    for (let step = 1; step <= CHORD_IDS.length; step++) {
        const candidate = CHORD_IDS[(start + step) % CHORD_IDS.length]
        if (candidate !== undefined && !completed.includes(candidate)) return candidate
    }
    return null
}

/** Uma linha com a próxima ação. Os detalhes ficam no guia e nas dicas. */
export function statusLine(input: GuideInput): string {
    if (!input.cameraActive) return 'Ative a câmera ou use Espaço para tocar.'
    if (input.trackerStatus === 'loading') return 'Carregando o detector de mão…'
    if (input.trackerStatus === 'error') return 'Não foi possível iniciar o detector de mão.'
    if (!input.fretVisible) {
        return `Mostre a mão ${input.leftHanded ? 'direita' : 'esquerda'} no braço.`
    }
    const { evaluation } = input
    if (evaluation.correction) return correctionText(evaluation.correction)
    if (!evaluation.complete) return 'Forme o acorde.'
    if (!input.stable) return 'Segure o formato.'
    if (input.completed.includes(input.chord)) {
        const next = nextChord(input.chord, input.completed)
        return next ? `${input.chord} concluído. Próximo: ${next}.` : 'Os cinco acordes concluídos.'
    }
    return input.strumVisible ? 'Bata com a outra mão.' : 'Mostre a outra mão para bater.'
}

/** Uma dica curta, de no máximo uma frase. */
export function guideHint(input: GuideInput): string {
    if (!input.cameraActive) return 'Sem câmera: Espaço bate para baixo, seta para cima bate para cima.'
    if (!input.fretVisible) return 'Mão aberta, palma para a câmera, dedos sobre as cordas.'
    if (input.evaluation.complete && input.stable) {
        return input.audioStatus === 'running'
            ? 'Desça a mão rápido sobre as cordas para tocar.'
            : 'Clique na tela ou aperte uma tecla para ligar o som.'
    }
    return 'Segure o dedo no círculo até ele ficar verde.'
}

/** Etapa atual (1 a 3), ou `null` sem câmera. */
export function currentStep(input: GuideInput): number | null {
    if (!input.cameraActive) return null
    if (!input.fretVisible) return 1
    if (input.stable && input.evaluation.complete) return 3
    return 2
}

/** Alternativa em texto do diagrama do acorde, corda por corda, da 6 à 1. */
export function chordDescription(chord: Chord): string {
    const parts = STRING_NUMBERS.map((string) => {
        const spec = chord.strings[string]
        if (spec.kind === 'muted') return `corda ${string} abafada`
        if (spec.kind === 'open') return `corda ${string} solta`
        return `corda ${string} casa ${spec.fret}, dedo ${spec.finger}`
    })
    return `Diagrama do ${chord.name} (${chord.label}): ${parts.join('; ')}.`
}
