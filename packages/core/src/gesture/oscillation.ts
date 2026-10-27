/**
 * Avaliador do critério `hand-angle-oscillation`: puro e determinístico, sem
 * DOM, sem relógio próprio e sem dependência do MediaPipe. Decide se, dentro de
 * uma janela de tempo, o ângulo da mão inverteu de direção vezes suficientes.
 */
import type { HandAngleOscillationCriterion } from '../contracts.js'

/** Uma leitura do ângulo da mão no instante `t` (ms do relógio da rodada). */
export interface HandSample {
    t: number
    angleDeg: number
}

/** Resultado de uma avaliação sobre a janela terminada no instante atual. */
export interface OscillationVerdict {
    recognized: boolean
    reversals: number
    windowSamples: number
}

/**
 * Conta inversões de direção com histerese: uma nova direção só vale depois que
 * o ângulo se afasta do último extremo por mais de `amplitudeDeg`. Variações
 * menores (ruído do detector) não contam. A direção inicial é indefinida, então
 * a primeira subida ou descida não é uma inversão.
 */
function countReversals(angles: readonly number[], amplitudeDeg: number): number {
    const first = angles[0]
    if (first === undefined) return 0
    let reversals = 0
    let direction: -1 | 0 | 1 = 0
    let extreme = first
    for (const angle of angles) {
        if (direction === 0) {
            if (Math.abs(angle - extreme) > amplitudeDeg) {
                direction = angle > extreme ? 1 : -1
                extreme = angle
            }
        } else if (direction === 1) {
            if (angle > extreme) extreme = angle
            else if (extreme - angle > amplitudeDeg) {
                direction = -1
                extreme = angle
                reversals++
            }
        } else if (angle < extreme) extreme = angle
        else if (angle - extreme > amplitudeDeg) {
            direction = 1
            extreme = angle
            reversals++
        }
    }
    return reversals
}

/**
 * Avalia as amostras da janela `(nowMs - windowMs, nowMs]`, em ordem crescente
 * de tempo. Reconhece quando há ao menos `minSamples` amostras e `minReversals`
 * inversões. Lacunas na série não são preenchidas: só contam as amostras com mão.
 */
export function evaluateOscillation(
    criterion: HandAngleOscillationCriterion,
    samples: readonly HandSample[],
    nowMs: number,
): OscillationVerdict {
    const windowStart = nowMs - criterion.windowMs
    const angles = samples
        .filter((sample) => sample.t > windowStart && sample.t <= nowMs)
        .map((sample) => sample.angleDeg)
    const reversals = countReversals(angles, criterion.amplitudeDeg)
    return {
        recognized:
            angles.length >= criterion.minSamples && reversals >= criterion.minReversals,
        reversals,
        windowSamples: angles.length,
    }
}
