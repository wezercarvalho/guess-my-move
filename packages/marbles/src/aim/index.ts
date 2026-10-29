/**
 * Controlador de mira puro e determinístico. Transforma leituras da mão (pinça
 * e estalo) num tiro — um vetor de velocidade no campo — sem conhecer alvo,
 * rodada, placar nem física. É a extração literal da leitura que vivia em
 * `round.ts`, para qualquer modo reaproveitar a mesma mira. O tempo entra só
 * pelos argumentos e NÃO importa `physics.ts` nem `round.ts`.
 */
import { DEFAULT_FLICK, type FlickConfig, type FlickReading, flickPower } from '../flick.js'
import { type PinchReading } from '../pinch.js'
import { DEFAULT_SHOT, type Shot, type ShotConfig, computeShot } from '../shot.js'

/** Ponto ou vetor 2D, em unidades do campo. Reproduzido aqui para não importar a física. */
export interface AimVec {
    x: number
    y: number
}

/** Parâmetros do controlador de mira; os valores padrão são palpites a calibrar com uso real. */
export interface AimConfig {
    /** Largura e altura do campo, em unidades (converte o ponto normalizado da mão). */
    width: number
    height: number
    shot: ShotConfig
    /** Parâmetros do estalo (modo alpha). */
    flick: FlickConfig
    /** Quanto o arrasto da mão vale no campo; a mira é relativa ao ponto onde a pinça fechou. */
    aimScale: number
    /** Tempo sem a mão, durante a mira, que cancela o tiro. */
    lostHandMs: number
}

export const DEFAULT_AIM: AimConfig = {
    width: 800,
    height: 600,
    shot: DEFAULT_SHOT,
    flick: DEFAULT_FLICK,
    aimScale: 1.5,
    lostHandMs: 300,
}

/** Qual gesto está mirando: a pinça mostra o elástico; o estalo, só a seta. */
export type AimKind = 'pinch' | 'flick'

/** Mira em andamento. `shot`/`direction` ficam `null` quando o arrasto ainda é curto. */
export interface AimInProgress {
    kind: AimKind
    /** Pinça virtual: a bolinha de tiro mais o arrasto da mão, na escala do campo. */
    pinch: AimVec
    /** Previsão do tiro da pinça (elástico); `null` fora do modo pinça ou com arrasto curto. */
    shot: Shot | null
    /** Direção unitária do estalo; `null` fora do modo estalo ou com arrasto curto. */
    direction: AimVec | null
}

/** Resultado de uma observação: a mira em andamento (ou `null`) e o tiro disparado (ou `null`). */
export interface AimOutcome {
    aiming: AimInProgress | null
    /** Vetor de velocidade do tiro no quadro em que ele dispara; `null` nos demais. */
    fired: AimVec | null
}

export interface AimController {
    /** Leitura da pinça a partir da posição corrente da bolinha de tiro; `nowMs` é o relógio do chamador. */
    observePinch(shooter: AimVec, reading: PinchReading, nowMs: number): AimOutcome
    /** Leitura do detector de estalo (modo alpha); `closed` significa armado. */
    observeFlick(shooter: AimVec, reading: FlickReading, nowMs: number): AimOutcome
    /** Cancela a mira em andamento (o chamador decidiu abortar). */
    cancel(): void
    /** Zera o controlador para uma nova mira (nenhum gesto em andamento). */
    reset(): void
}

/** Cria o controlador de mira. Guarda só o estado da mira corrente. */
export function createAimController(overrides: Partial<AimConfig> = {}): AimController {
    const cfg: AimConfig = { ...DEFAULT_AIM, ...overrides }

    /** Onde a pinça fechou (campo); a mira conta o deslocamento a partir daqui. */
    let aimAnchor: AimVec | null = null
    /** Pinça virtual: a bolinha de tiro mais o arrasto da mão, já na escala do campo. */
    let aimPinch: AimVec | null = null
    let aimKind: AimKind | null = null
    let lastSeenMs = 0
    /** A leitura anterior tinha a mão à vista e a pinça aberta. */
    let prevOpen = false

    function clearAim(): void {
        aimAnchor = null
        aimPinch = null
        aimKind = null
    }

    function fieldPoint(reading: { handVisible: boolean; point: { x: number; y: number } | null }): AimVec | null {
        if (!reading.handVisible || !reading.point) return null
        return { x: reading.point.x * cfg.width, y: reading.point.y * cfg.height }
    }

    /** Pinça virtual: a bolinha de tiro mais o deslocamento da mão desde que armou, na escala do campo. */
    function virtualPinch(shooter: AimVec, point: AimVec): AimVec {
        const anchor = aimAnchor ?? point
        return {
            x: shooter.x + (point.x - anchor.x) * cfg.aimScale,
            y: shooter.y + (point.y - anchor.y) * cfg.aimScale,
        }
    }

    /** Direção unitária do estilingue (da pinça virtual para a bolinha); `null` se o arrasto é curto. */
    function aimDirection(shooter: AimVec, pinch: AimVec): AimVec | null {
        const shot = computeShot(shooter, pinch, cfg.shot)
        if (!shot) return null
        const length = Math.hypot(shot.velocity.x, shot.velocity.y)
        return { x: shot.velocity.x / length, y: shot.velocity.y / length }
    }

    function pinchAiming(shooter: AimVec): AimInProgress | null {
        if (aimKind !== 'pinch' || !aimPinch) return null
        return { kind: 'pinch', pinch: { ...aimPinch }, shot: computeShot(shooter, aimPinch, cfg.shot), direction: null }
    }

    function flickAiming(shooter: AimVec): AimInProgress | null {
        if (aimKind !== 'flick' || !aimPinch) return null
        return { kind: 'flick', pinch: { ...aimPinch }, shot: null, direction: aimDirection(shooter, aimPinch) }
    }

    function aimingOf(shooter: AimVec): AimInProgress | null {
        return aimKind === 'pinch' ? pinchAiming(shooter) : aimKind === 'flick' ? flickAiming(shooter) : null
    }

    function observePinch(shooter: AimVec, reading: PinchReading, nowMs: number): AimOutcome {
        const point = fieldPoint(reading)
        const closedNow = reading.closed && point !== null
        let fired: AimVec | null = null

        if (aimKind === null) {
            // A mira começa ao fechar a pinça (aberta na leitura anterior), em qualquer lugar.
            if (closedNow && prevOpen && point) {
                aimAnchor = point
                aimPinch = { ...shooter }
                aimKind = 'pinch'
                lastSeenMs = nowMs
            }
        } else if (aimKind === 'pinch') {
            if (!point) {
                if (nowMs - lastSeenMs > cfg.lostHandMs) clearAim()
            } else {
                lastSeenMs = nowMs
                if (closedNow) {
                    aimPinch = virtualPinch(shooter, point)
                } else {
                    // Ao abrir a pinça, vale a última posição com a pinça fechada.
                    const shot = aimPinch ? computeShot(shooter, aimPinch, cfg.shot) : null
                    if (shot) fired = { ...shot.velocity }
                    clearAim()
                }
            }
        }

        prevOpen = point !== null && !reading.closed
        return { aiming: aimingOf(shooter), fired }
    }

    function observeFlick(shooter: AimVec, reading: FlickReading, nowMs: number): AimOutcome {
        const point = fieldPoint(reading)
        const armedNow = reading.closed && point !== null
        let fired: AimVec | null = null

        if (aimKind === null) {
            if (armedNow && point) {
                aimAnchor = point
                aimPinch = { ...shooter }
                aimKind = 'flick'
                lastSeenMs = nowMs
            }
        } else if (aimKind === 'flick') {
            if (!point) {
                if (nowMs - lastSeenMs > cfg.lostHandMs) clearAim()
                return { aiming: aimingOf(shooter), fired: null }
            }
            lastSeenMs = nowMs
            if (reading.release) {
                // A mira trava na posição da mão antes de o polegar subir.
                const strength = flickPower(reading.release, cfg.flick)
                const locked = {
                    x: reading.release.point.x * cfg.width,
                    y: reading.release.point.y * cfg.height,
                }
                const direction = strength ? aimDirection(shooter, virtualPinch(shooter, locked)) : null
                if (strength && direction) {
                    fired = { x: direction.x * strength.speed, y: direction.y * strength.speed }
                }
                clearAim()
            } else if (armedNow) {
                // Enquanto o polegar sobe (confirmando), a posição da mão perturbada não mexe na mira.
                if (reading.phase !== 'pending') aimPinch = virtualPinch(shooter, point)
            } else {
                // O detector zerou o armado sem soltura (a mão sumiu e voltou esticada).
                clearAim()
            }
        }

        return { aiming: aimingOf(shooter), fired }
    }

    return {
        observePinch,
        observeFlick,
        cancel() {
            clearAim()
        },
        reset() {
            clearAim()
            prevOpen = false
            lastSeenMs = 0
        },
    }
}
