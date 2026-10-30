import { type Contact } from './cityIndex.js'
import { type Vec3 } from './vec.js'

/**
 * Agarre à parede do Arranha-Teia. Em contato com a fachada de um prédio, abrir as mãos
 * gruda o jogador na parede; descer uma mão por vez (ou as duas) sobe, as duas mãos subindo
 * juntas desce; o punho fechado solta. Toda a regra aqui é pura e testável sem navegador.
 */

/**
 * Estado do agarre: a normal da parede agarrada, o topo do prédio, e os relógios que
 * garantem a saída (sem movimento, sem mão por tempo demais, punho segurado).
 */
export interface WallGrip {
    /** Normal da parede (horizontal), para a tela e para manter o jogador encostado. */
    normal: Vec3
    /** Altura do prédio agarrado, em metros: ao passar dela, o jogador sai no telhado. */
    wallTop: number
    /** Tempo acumulado sem pedido de agarre, em ms (tolera a perda curta da mão/palma). */
    graceMs: number
    /** Tempo acumulado com o punho fechado pedindo soltar, em ms. */
    fistMs: number
}

/** Valores de jogo do agarre (não realistas; ajustáveis sem mudar a arquitetura). */
export interface GripConfig {
    /** Velocidade máxima de subida/descida na parede, em m/s. */
    climbSpeed: number
    /** Abaixo disto, o sinal de escalada conta como zero (zona morta do movimento). */
    climbDeadzone: number
    /** Tolerância, em ms, para a perda curta da mão/palma no meio da escalada. */
    grabGraceMs: number
    /** Tempo, em ms, com o punho fechado que solta o agarre de propósito. */
    fistReleaseMs: number
}

export const DEFAULT_GRIP: GripConfig = {
    climbSpeed: 6,
    climbDeadzone: 0.06,
    grabGraceMs: 300,
    fistReleaseMs: 250,
}

/**
 * Sinal de escalada a partir do deslocamento vertical do pulso de cada mão entre dois
 * quadros (coordenadas normalizadas de imagem; y cresce para baixo). Cada mão que DESCE na
 * imagem (dy > 0) puxa o corpo para cima — `up = max(0,dyEsq) + max(0,dyDir)`, então uma
 * mão só, ou alternar as mãos, já sobe. As DUAS mãos subindo ao mesmo tempo (dy < 0) descem
 * — `down = min(max(0,-dyEsq), max(0,-dyDir))`, zero se uma mão não sobe. Uma mão ausente
 * conta dy = 0. Devolve `clamp(up - down)` de -1 a 1, com zona morta e saturação. Dados
 * sintéticos nos testes: nada aqui afirma precisão do rastreio.
 */
export function climbSignal(dyLeft: number, dyRight: number, config: GripConfig = DEFAULT_GRIP): number {
    const up = Math.max(0, dyLeft) + Math.max(0, dyRight)
    const down = Math.min(Math.max(0, -dyLeft), Math.max(0, -dyRight))
    const raw = up - down
    const magnitude = Math.abs(raw)
    if (magnitude < config.climbDeadzone) return 0
    // Escala a amplitude acima da zona morta e satura em 1; o sinal dá o sentido.
    const scaled = (magnitude - config.climbDeadzone) / (config.climbDeadzone * 4)
    return Math.sign(raw) * Math.min(1, scaled)
}

/** O que o passo precisa saber do pedido do jogador para o agarre. */
export interface GripInput {
    /** Alguma mão pede o agarre neste passo (palma aberta em contato, ou a tecla). */
    grab: boolean
    /** Sinal de escalada (-1 a 1); positivo sobe, negativo desce. */
    climb: number
    /** Punho fechado pedindo soltar neste quadro (solta ao segurar além de `fistReleaseMs`). */
    releaseFist: boolean
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
 * `climb * climbSpeed` e sai por uma das condições (punho segurado, teia, topo,
 * ou perder o pedido de agarre além da tolerância). Altera `state` no lugar via os objetos
 * passados.
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
    const dtMs = dt * 1000

    // Entrar: contato de parede mais o pedido de agarrar.
    if (state.grip === null) {
        if (input.grab && touchingWall && contact) {
            const wallTop = wallTopAt ? wallTopAt(state.position.x, state.position.z) : Infinity
            state.grip = { normal: { ...contact.normal }, wallTop, graceMs: 0, fistMs: 0 }
            state.velocity = { x: 0, y: 0, z: 0 }
            return { gripped: true, toppedOut: false }
        }
        return { gripped: false, toppedOut: false }
    }

    // Lançar uma teia encerra o agarre na hora (um regime por vez).
    if (input.hasWeb) {
        state.grip = null
        return { gripped: false, toppedOut: false }
    }

    // Soltar de propósito: punho fechado segurado além do tempo.
    if (input.releaseFist) {
        state.grip.fistMs += dtMs
        if (state.grip.fistMs >= config.fistReleaseMs) {
            state.grip = null
            return { gripped: false, toppedOut: false }
        }
    } else {
        state.grip.fistMs = 0
    }

    // Perder o pedido de agarre: tolera um lapso curto (quadro ruim, palma não lida); além
    // da tolerância, solta. O pedido de volta reinicia a tolerância.
    if (!input.grab) {
        state.grip.graceMs += dtMs
        if (state.grip.graceMs > config.grabGraceMs) {
            state.grip = null
            return { gripped: false, toppedOut: false }
        }
    } else {
        state.grip.graceMs = 0
    }

    // Atualiza a normal com o contato mais recente, para acompanhar cantos.
    if (contact && touchingWall) state.grip.normal = { ...contact.normal }

    // Mover ao longo da vertical; colado à parede (quem chama resolve a posição horizontal).
    // Parado agarrado é permitido: segurar a mão (ou a tecla) é o pedido deliberado de ficar.
    const climb = Math.max(-1, Math.min(1, input.climb))
    state.velocity = { x: 0, y: 0, z: 0 }
    if (Math.abs(climb) >= config.climbDeadzone) {
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

    return { gripped: true, toppedOut: false }
}
