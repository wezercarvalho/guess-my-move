import { describe, expect, it } from 'vitest'

import matchSource from '../src/match/index.ts?raw'
import { type Body, DEFAULT_PHYSICS } from '../src/physics.js'
import {
    type Mode,
    type Opponent,
    type Outcome,
    type ShotSource,
    createMatch,
} from '../src/match/index.js'

const bola = (x: number, vx = 0): Body => ({ pos: { x, y: 300 }, vel: { x: vx, y: 0 }, radius: 14 })

/** Fonte de tiro que devolve, em ordem, os vetores de velocidade dados; depois disso, parada. */
function fonteFixa(...vels: { x: number; y: number }[]): ShotSource {
    let i = 0
    return {
        nextShot() {
            return i < vels.length ? vels[i++] : null
        },
    }
}

/**
 * Modo de teste do bete: uma bolinha de tiro (índice 0) e um alvo (índice 1).
 * Acerto = contato. Avaliação pede ao modo; a vez alterna por padrão.
 */
function modoBeteTeste(opts: { limiteMeta?: number; limiteBot?: number } = {}): Mode {
    const limiteMeta = opts.limiteMeta ?? 5
    const limiteBot = opts.limiteBot ?? 5
    return {
        name: 'bete-teste',
        helpText: 'Acerte o alvo. Vitória ao acertar cedo; empate tarde; derrota sem acertar.',
        roundsPerMatch: 3,
        buildRound() {
            return [bola(150), bola(550)]
        },
        shotLimit(_competitor, opponent) {
            return opponent === 'target' ? limiteMeta : limiteBot
        },
        evaluate(context) {
            const acertou = context.contactsInRound.some(([a, b]) => a === 0 && b === 1)
            if (acertou) {
                return { yield: 1, finished: true, outcome: 'win' }
            }
            return { yield: 0, finished: false, outcome: null }
        },
    }
}

/** Joga a partida inteira com as fontes dadas e devolve os resultados por rodada. */
function jogar(
    mode: Mode,
    opponent: Opponent,
    sources: { player: ShotSource; bot?: ShotSource },
): { rodadas: Outcome[]; resultado: Outcome } {
    const match = createMatch({ mode, opponent, sources, physics: DEFAULT_PHYSICS })
    let guarda = 0
    while (!match.finished() && guarda++ < 1000) {
        match.nextStep()
    }
    return { rodadas: match.roundOutcomes(), resultado: match.matchOutcome() }
}

describe('motor de partida: resultado da partida', () => {
    it('2 vitórias e 1 derrota = vitória; 1-1-1 = empate; 3 empates = empate; 1 vitória e 2 derrotas = derrota', () => {
        const calc = (rodadas: Outcome[]): Outcome => {
            const match = createMatch({
                mode: modoBeteTeste(),
                opponent: 'target',
                sources: { player: fonteFixa() },
                physics: DEFAULT_PHYSICS,
            })
            return match.computeOutcome(rodadas)
        }
        expect(calc(['win', 'win', 'loss'])).toBe('win')
        expect(calc(['win', 'draw', 'loss'])).toBe('draw')
        expect(calc(['draw', 'draw', 'draw'])).toBe('draw')
        expect(calc(['win', 'loss', 'loss'])).toBe('loss')
    })
})

describe('motor de partida: contra a meta', () => {
    it('o jogador atira sempre que as bolinhas param; acertar cedo vence a rodada', () => {
        // Tiro forte rumo ao alvo (à esquerda do shooter): velocidade negativa? alvo está à direita.
        const { resultado } = jogar(modoBeteTeste(), 'target', { player: fonteFixa({ x: 2000, y: 0 }, { x: 2000, y: 0 }, { x: 2000, y: 0 }) })
        expect(resultado).toBe('win')
    })

    it('esgotar os tiros sem acertar não prende a rodada e dá derrota', () => {
        const { rodadas } = jogar(modoBeteTeste({ limiteMeta: 2 }), 'target', {
            player: fonteFixa({ x: 0, y: -100 }, { x: 0, y: -100 }, { x: 0, y: -100 }, { x: 0, y: -100 }, { x: 0, y: -100 }, { x: 0, y: -100 }),
        })
        expect(rodadas).toHaveLength(3)
        for (const r of rodadas) expect(r).toBe('loss')
    })

    it('uma vitória decidida encerra a rodada sem consumir os tiros restantes', () => {
        const match = createMatch({
            mode: modoBeteTeste({ limiteMeta: 5 }),
            opponent: 'target',
            sources: { player: fonteFixa({ x: 2000, y: 0 }) },
            physics: DEFAULT_PHYSICS,
        })
        while (match.currentRound() === 0 && !match.finished()) match.nextStep()
        expect(match.shotsSpentInPreviousRound()).toBe(1)
    })
})

describe('motor de partida: contra o bot', () => {
    it('o jogador começa a rodada 1 e a ordem alterna por rodada', () => {
        const match = createMatch({
            mode: modoBeteTeste(),
            opponent: 'bot',
            sources: { player: fonteFixa({ x: 0, y: -50 }), bot: fonteFixa({ x: 0, y: -50 }) },
            physics: DEFAULT_PHYSICS,
        })
        expect(match.startsRound(0)).toBe('player')
        expect(match.startsRound(1)).toBe('opponent')
        expect(match.startsRound(2)).toBe('player')
    })

    it('contra a meta não há vez (sempre o jogador)', () => {
        const match = createMatch({
            mode: modoBeteTeste(),
            opponent: 'target',
            sources: { player: fonteFixa() },
            physics: DEFAULT_PHYSICS,
        })
        expect(match.startsRound(0)).toBe('player')
        expect(match.startsRound(1)).toBe('player')
    })
})

describe('fonte do tiro e cadeia', () => {
    it('o efeito em cadeia é atribuído ao competidor do tiro corrente', () => {
        // Modo de 3 bolinhas: o tiro (0) empurra (1), que empurra (2) para fora; a captura é do atirador.
        const modoCadeia: Mode = {
            name: 'cadeia-teste',
            helpText: 'Empurre em cadeia. Vitória ao capturar; empate/derrota conforme as capturas.',
            roundsPerMatch: 1,
            buildRound() {
                return [bola(150), bola(300), bola(320)]
            },
            shotLimit() {
                return 1
            },
            evaluate(context) {
                // Captura = bolinha que saiu pela direita do campo (x perto da parede).
                const capturas = context.field.filter((b, i) => i > 0 && b.pos.x > 700).length
                return { yield: capturas, finished: capturas > 0, outcome: capturas > 0 ? 'win' : 'loss' }
            },
        }
        const match = createMatch({
            mode: modoCadeia,
            opponent: 'target',
            sources: { player: fonteFixa({ x: 3000, y: 0 }) },
            physics: DEFAULT_PHYSICS,
        })
        let guarda = 0
        while (!match.finished() && guarda++ < 1000) match.nextStep()
        expect(match.yieldOf('player')).toBeGreaterThan(0)
    })

    it('determinismo: a mesma sequência de tiros produz o mesmo resultado', () => {
        const run = () =>
            jogar(modoBeteTeste({ limiteMeta: 3 }), 'target', {
                player: fonteFixa({ x: 0, y: -80 }, { x: 2000, y: 0 }, { x: 2000, y: 0 }),
            }).resultado
        expect(run()).toBe(run())
    })
})

describe('motor de partida: pureza', () => {
    it('não importa DOM, MediaPipe nem relógio do navegador', () => {
        const imports = matchSource.match(/from\s+'[^']+'/g) ?? []
        for (const line of imports) expect(line).not.toMatch(/mediapipe|dom/i)
        // Sem chamadas a globais de navegador nem a relógio (ignora menções em comentários).
        expect(matchSource).not.toMatch(/\bdocument\.|\bwindow\.|requestAnimationFrame\s*\(/)
        expect(matchSource).not.toMatch(/Date\.now\s*\(|performance\.now\s*\(/)
    })
})
