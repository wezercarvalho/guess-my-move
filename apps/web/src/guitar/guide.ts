import { type Chord, type ChordId, STRING_NUMBERS } from '@guess-my-move/guitar'

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
    detectedChord: ChordId | null
    completed: readonly ChordId[]
    audioStatus: AudioStatus
}

/** As três etapas do guia "Como jogar". */
export const STEPS: readonly string[] = [
    'Posicione as mãos',
    'Monte qualquer acorde',
    'Atravesse as cordas',
]

/** Uma linha com a próxima ação. Os detalhes ficam no guia e nas dicas. */
export function statusLine(input: GuideInput): string {
    if (!input.cameraActive) return 'Ative a câmera ou use Espaço para testar o som.'
    if (input.trackerStatus === 'loading') return 'Carregando o detector de mão…'
    if (input.trackerStatus === 'error') return 'Não foi possível iniciar o detector de mão.'
    if (!input.fretVisible) {
        return `Mostre a mão ${input.leftHanded ? 'direita' : 'esquerda'} sobre o braço.`
    }
    if (!input.detectedChord) return 'Ajuste os dedos até o acorde aparecer.'
    if (input.completed.includes(input.detectedChord)) {
        return `${input.detectedChord} tocado. Monte outro acorde.`
    }
    return input.strumVisible
        ? `${input.detectedChord} reconhecido. Atravesse as cordas.`
        : `${input.detectedChord} reconhecido. Mostre a outra mão.`
}

/** Uma dica curta, de no máximo uma frase. */
export function guideHint(input: GuideInput): string {
    if (!input.cameraActive) return 'Sem câmera: Espaço bate para baixo, seta para cima bate para cima.'
    if (!input.fretVisible) return 'Deixe a palma para a câmera e alinhe as pontas às cordas.'
    if (!input.detectedChord) return 'As pontas verdes indicam corda e casa já confirmadas.'
    return input.audioStatus === 'running'
        ? 'Passe a outra mão de cima para baixo ou de baixo para cima.'
        : 'Clique na tela ou aperte uma tecla para ligar o som.'
}

/** Etapa atual (1 a 3), ou `null` sem câmera. */
export function currentStep(input: GuideInput): number | null {
    if (!input.cameraActive) return null
    if (!input.fretVisible) return 1
    return input.detectedChord ? 3 : 2
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
