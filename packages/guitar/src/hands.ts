import { type BoardPlacement, type ScreenPoint } from './board.js'

/**
 * Mão do quadro com 21 pontos já na tela espelhada (o que o jogador vê). O rótulo
 * Left/Right do MediaPipe pode vir junto, mas é ignorado: inverte com a imagem espelhada
 * e fica instável com as mãos perto.
 */
export interface HandInput {
    readonly landmarks: readonly ScreenPoint[]
    readonly handedness?: string
}

export interface HandRoles<T extends HandInput = HandInput> {
    /** Mão que forma o acorde (a do lado da pestana). */
    readonly fretting: T | null
    /** Mão que bate. */
    readonly strumming: T | null
}

/** Margem em volta da divisa em que uma mão sozinha mantém o papel (hipótese a calibrar). */
export const DEFAULT_SPLIT_MARGIN = 0.03

const WRIST = 0

type Role = 'fretting' | 'strumming'

/**
 * Separa a mão do braço da mão da batida **pela posição na tela**. Com duas ou mais mãos,
 * a mais próxima da pestana forma o acorde e a mais distante bate. Com uma só, vale o lado
 * da divisa (a borda do braço); dentro da margem, ela mantém o papel anterior.
 */
export class HandRoleAssigner {
    private lastRole: Role | null = null

    constructor(private readonly margin: number = DEFAULT_SPLIT_MARGIN) {}

    assign<T extends HandInput>(hands: readonly T[], placement: BoardPlacement): HandRoles<T> {
        if (hands.length === 0) {
            return { fretting: null, strumming: null }
        }
        const wristX = (hand: T) => hand.landmarks[WRIST]?.x ?? 0.5
        // da pestana para longe: no braço destro, da esquerda para a direita
        const ordered = [...hands].sort((a, b) =>
            placement.leftHanded ? wristX(b) - wristX(a) : wristX(a) - wristX(b),
        )
        if (ordered.length >= 2) {
            this.lastRole = null
            return { fretting: ordered[0], strumming: ordered[ordered.length - 1] }
        }
        const only = ordered[0]
        const split = placement.leftHanded ? placement.x : placement.x + placement.width
        const towardNut = placement.leftHanded ? wristX(only) - split : split - wristX(only)
        let role: Role
        if (towardNut > this.margin) role = 'fretting'
        else if (towardNut < -this.margin) role = 'strumming'
        else role = this.lastRole ?? (towardNut >= 0 ? 'fretting' : 'strumming')
        this.lastRole = role
        return role === 'fretting'
            ? { fretting: only, strumming: null }
            : { fretting: null, strumming: only }
    }

    reset(): void {
        this.lastRole = null
    }
}
