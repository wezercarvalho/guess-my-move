import { type Contact } from './cityIndex.js'
import { type Vec3 } from './vec.js'

/**
 * Agarre à parede do Arranha-Teia. Em contato com a fachada de um prédio, abrir as mãos
 * gruda o jogador na parede; mover as mãos alternadamente sobe ou desce; puxar a mão para
 * trás (ou largar o gesto) solta. Toda a regra aqui é pura e testável sem navegador.
 */

/** Estado do agarre: a normal da parede agarrada e o tempo sem movimento de escalada. */
export interface WallGrip {
    /** Normal da parede (horizontal), para a tela e para manter o jogador encostado. */
    normal: Vec3
    /** Altura do prédio agarrado, em metros: ao passar dela, o jogador sai no telhado. */
    wallTop: number
    /** Tempo acumulado sem movimento de escalada, em ms (solta sozinho ao passar da tolerância). */
    idleMs: number
}

/** Valores de jogo do agarre (não realistas; ajustáveis sem mudar a arquitetura). */
export interface GripConfig {
    /** Velocidade máxima de subida/descida na parede, em m/s. */
    climbSpeed: number
    /** Abaixo disto, o sinal de escalada conta como zero (zona morta do movimento). */
    climbDeadzone: number
    /** Tempo, em ms, sem movimento de escalada que solta o agarre sozinho. */
    gripIdleMs: number
    /** Aumento de profundidade do pulso (z) que conta como "puxar a mão para trás". */
    pullBackThreshold: number
}

export const DEFAULT_GRIP: GripConfig = {
    climbSpeed: 6,
    climbDeadzone: 0.06,
    gripIdleMs: 1500,
    pullBackThreshold: 0.08,
}

/**
 * Sinal de escalada a partir do deslocamento vertical do pulso de cada mão entre dois
 * quadros (coordenadas normalizadas de imagem; y cresce para baixo). O movimento ALTERNADO
 * — uma mão desce enquanto a outra sobe — puxa o corpo para cima; o sentido segue a mão que
 * desce. Devolve de -1 a 1, com zona morta e saturação. Dados sintéticos nos testes: nada
 * aqui afirma precisão do rastreio.
 */
export function climbSignal(dyLeft: number, dyRight: number, config: GripConfig = DEFAULT_GRIP): number {
    // Componente de "puxar para cima" de cada mão: descer na imagem (dy > 0) puxa o corpo
    // para cima. O alternado é a média dos dois, mas só quando os sinais são opostos: duas
    // mãos no mesmo sentido (movimento conjunto) quase se cancelam.
    const alternation = (dyLeft - dyRight) / 2
    const magnitude = Math.abs(alternation)
    if (magnitude < config.climbDeadzone) return 0
    // Escala a amplitude acima da zona morta e satura em 1; o sinal dá o sentido.
    const scaled = (magnitude - config.climbDeadzone) / (config.climbDeadzone * 4)
    return Math.sign(alternation) * Math.min(1, scaled)
}

/**
 * "Puxar a mão para trás": verdadeiro quando ALGUMA mão se afasta da câmera além do limite
 * (a profundidade z do MediaPipe cresce para longe). Aproximado — o z do MediaPipe não foi
 * medido ao vivo; por isso este sinal nunca é a única saída do agarre.
 */
export function pullBackSignal(dzLeft: number, dzRight: number, config: GripConfig = DEFAULT_GRIP): boolean {
    return dzLeft > config.pullBackThreshold || dzRight > config.pullBackThreshold
}

/** O que o passo precisa saber do pedido do jogador para o agarre. */
export interface GripInput {
    /** Alguma mão pede o agarre neste passo. */
    grab: boolean
    /** Sinal de escalada (-1 a 1); positivo sobe, negativo desce. */
    climb: number
    /** Puxar a mão para trás: soltar da parede. */
    release: boolean
    /** Há teia presa neste passo (lançar uma teia encerra o agarre). */
    hasWeb: boolean
}

/** Resultado de um passo do agarre: se o jogador está agarrado e se saiu para o telhado. */
export interface GripStep {
    /** O jogador está agarrado ao fim do passo. */
    gripped: boolean
    /** Saiu do agarre por chegar ao topo: fica em pé no telhado. */
    toppedOut: boolean
}

/**
 * Decide e aplica o agarre num passo. Entra só com contato de parede (`contact.kind` != roof)
 * mais o pedido de agarrar; ao entrar, zera a velocidade e marca a parede. Agarrado, não há
 * gravidade nem deslize (quem chama pula essa parte): aqui o jogador sobe/desce por
 * `climb * climbSpeed` e sai por uma das quatro condições (largar/puxar, teia, topo,
 * inatividade). Altera `state` no lugar via os objetos passados.
 */
export function stepGrip(
    state: { position: Vec3; velocity: Vec3; grip: WallGrip | null; grounded: boolean },
    input: GripInput,
    dt: number,
    contact: Contact | null,
    config: GripConfig = DEFAULT_GRIP,
    wallTopAt?: (x: number, z: number) => number,
    radius = 1.7,
): GripStep {
    const touchingWall = contact !== null && contact.kind !== 'roof'

    // Entrar: contato de parede mais o pedido de agarrar.
    if (state.grip === null) {
        if (input.grab && touchingWall && contact) {
            const wallTop = wallTopAt ? wallTopAt(state.position.x, state.position.z) : Infinity
            state.grip = { normal: { ...contact.normal }, wallTop, idleMs: 0 }
            state.velocity = { x: 0, y: 0, z: 0 }
            return { gripped: true, toppedOut: false }
        }
        return { gripped: false, toppedOut: false }
    }

    // Saídas que não dependem do movimento (robustas): largar/puxar, teia, perder o contato.
    if (!input.grab || input.release || input.hasWeb) {
        state.grip = null
        return { gripped: false, toppedOut: false }
    }

    // Atualiza a normal com o contato mais recente, para acompanhar cantos.
    if (contact && touchingWall) state.grip.normal = { ...contact.normal }

    // Mover ao longo da vertical; colado à parede (quem chama resolve a posição horizontal).
    const climb = Math.max(-1, Math.min(1, input.climb))
    state.velocity = { x: 0, y: 0, z: 0 }
    if (Math.abs(climb) < config.climbDeadzone) {
        state.grip.idleMs += dt * 1000
    } else {
        state.grip.idleMs = 0
        state.position.y += climb * config.climbSpeed * dt
    }

    // Saída por topo: passou da altura do prédio agarrado — sai em pé no telhado.
    if (state.position.y >= state.grip.wallTop) {
        // Sobe para o telhado e entra um pouco no prédio, para ficar em pé em vez de cair pela fachada.
        const normal = state.grip.normal
        state.position.x -= normal.x * (radius + 0.5)
        state.position.z -= normal.z * (radius + 0.5)
        state.position.y = state.grip.wallTop
        state.grip = null
        state.grounded = true
        return { gripped: false, toppedOut: true }
    }

    // Saída por inatividade: sem movimento de escalada por tempo acima da tolerância.
    if (state.grip.idleMs > config.gripIdleMs) {
        state.grip = null
        return { gripped: false, toppedOut: false }
    }

    return { gripped: true, toppedOut: false }
}
