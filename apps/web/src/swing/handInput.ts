import {
    climbSignal,
    handMetrics,
    handSide,
    isFist,
    isOpenPalm,
    isThumbDownOpenHand,
    webSignal,
    type TriggerGesture,
} from '@guess-my-move/swing'
import type { TrackedHand } from '../tracker/handTracker.js'
import type { HandDebug } from './swingTypes.js'

export function deriveSwingHands(
    hands: readonly TrackedHand[],
    gripped: boolean,
    previousWrist: Readonly<{ left: number | null; right: number | null }>,
) {
    const signals: {
        left: TriggerGesture | null
        right: TriggerGesture | null
    } = {
        left: null,
        right: null,
    }
    const debug: HandDebug[] = []
    const openPalm = { left: false, right: false }
    const closedFist = { left: false, right: false }
    // Já agarrado, a mão no gesto de travar continua valendo como mão aberta (não derruba o agarre).

    let lockSeen = false
    const wrist: { left: number | null; right: number | null } = {
        left: null,
        right: null,
    }
    // A imagem da câmera é invertida: o maior x cru fica mais à esquerda na tela.
    const order = hands
        .map((tracked, index) => ({
            tracked,
            index,
            x: tracked.landmarks[9]?.x ?? 0.5,
        }))
        .sort((a, b) => b.x - a.x)
    order.forEach(({ tracked }, position) => {
        const side =
            order.length === 2
                ? position === 0
                    ? 'left'
                    : 'right'
                : handSide(tracked.landmarks)
        // O dedão para baixo trava a direção: não é pose de teia nem palma aberta (não solta a teia
        // nem agarra a parede), salvo para manter um agarre que já existe.
        const lockPose = isThumbDownOpenHand(tracked.landmarks)
        lockSeen ||= lockPose
        const signal = lockPose
            ? null
            : webSignal(tracked.landmarks, tracked.gesture)
        signals[side] = signal
        const palmOpen = isOpenPalm(tracked.landmarks) && !lockPose
        const fistClosed = isFist(tracked.landmarks)
        openPalm[side] = palmOpen || (lockPose && gripped)
        closedFist[side] = fistClosed
        const w = tracked.landmarks[0] as { x: number; y: number } | undefined
        if (w) wrist[side] = w.y
        debug.push({
            side: side === 'left' ? 'esq.' : 'dir.',
            label: tracked.gesture?.name ?? null,
            signal: signal?.name ?? null,
            metrics: handMetrics(tracked.landmarks),
            openPalm: palmOpen,
            fist: fistClosed,
            lockPose,
        })
    })

    // Escalada: deslocamento vertical do pulso de cada mão. Descer na imagem puxa o corpo
    // para cima; as duas subindo ao mesmo tempo descem (regra em `climbSignal`).
    const dyLeft =
        previousWrist.left !== null && wrist.left !== null
            ? wrist.left - previousWrist.left
            : 0
    const dyRight =
        previousWrist.right !== null && wrist.right !== null
            ? wrist.right - previousWrist.right
            : 0
    const climb = climbSignal(dyLeft, dyRight)
    // Soltar da parede: punho fechado de qualquer mão (o passo exige segurá-lo por tempo).
    const releaseFist = closedFist.left || closedFist.right
    return {
        signals,
        debug,
        grabs: openPalm,
        lockPose: lockSeen,
        climb,
        releaseFist,
        wrist,
    }
}
