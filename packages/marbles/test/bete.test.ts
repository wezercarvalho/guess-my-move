import { describe, expect, it } from 'vitest'

import { DEFAULT_BETE_MODE, createBeteMode } from '../src/modes/bete/index.js'
import { DEFAULT_BOT, createBotPlanner } from '../src/bot/index.js'
import { DEFAULT_PHYSICS } from '../src/physics.js'
import {
    type Opponent,
    type Outcome,
    type ShotSource,
    createMatch,
} from '../src/match/index.js'

/**
 * Fonte de tiro que mira o alvo (índice 1) com uma rapidez dada, calculada a
 * partir do campo preparado. `acerta=false` atira para o lado para errar de
 * propósito. Determinística e sem física do bot: só um vetor em linha reta.
 */
function fonteBete(opts: { acerta: boolean; rapidez?: number }): ShotSource {
    const rapidez = opts.rapidez ?? 2200
    return {
        nextShot(field) {
            if (!field || field.length < 2) return { x: rapidez, y: 0 }
            const atirador = field[0]
            const alvo = field[1]
            if (opts.acerta) {
                const dx = alvo.pos.x - atirador.pos.x
                const dy = alvo.pos.y - atirador.pos.y
                const len = Math.hypot(dx, dy) || 1
                return { x: (dx / len) * rapidez, y: (dy / len) * rapidez }
            }
            // Erra: atira na vertical, longe do alvo.
            return { x: 0, y: -80 }
        },
    }
}

/** Joga a rodada 0 até ela encerrar e devolve o resultado dela. */
function jogarRodada(
    acertaNoTiro: number | null,
    opponent: Opponent = 'target',
): { rodadas: Outcome[]; match: ReturnType<typeof createMatch> } {
    // Fonte do jogador que erra até o tiro de índice `acertaNoTiro` (1-based) e então acerta.
    let tiro = 0
    const jogador: ShotSource = {
        nextShot(field) {
            tiro++
            const acerta = acertaNoTiro !== null && tiro === acertaNoTiro
            return fonteBete({ acerta }).nextShot(field)
        },
    }
    const match = createMatch({
        mode: createBeteMode(),
        opponent,
        sources: { player: jogador, bot: fonteBete({ acerta: false }) },
        physics: DEFAULT_PHYSICS,
    })
    let guarda = 0
    while (match.currentRound() === 0 && !match.finished() && guarda++ < 2000) match.nextStep()
    return { rodadas: match.roundOutcomes(), match }
}

describe('modo Bete: contra a meta', () => {
    it('acertar no 3º tiro é vitória e encerra a rodada', () => {
        const { rodadas } = jogarRodada(3, 'target')
        expect(rodadas[0]).toBe('win')
    })

    it('acertar no 4º tiro é empate', () => {
        const { rodadas } = jogarRodada(4, 'target')
        expect(rodadas[0]).toBe('draw')
    })

    it('acertar no 5º tiro é empate', () => {
        const { rodadas } = jogarRodada(5, 'target')
        expect(rodadas[0]).toBe('draw')
    })

    it('5 tiros sem acertar é derrota', () => {
        const { rodadas } = jogarRodada(null, 'target')
        expect(rodadas[0]).toBe('loss')
    })

    it('a vitória decidida no 2º tiro não consome os tiros restantes', () => {
        const { match } = jogarRodada(2, 'target')
        expect(match.shotsSpentInPreviousRound()).toBe(2)
    })
})

describe('modo Bete: posições do alvo', () => {
    it('o alvo ocupa 3 posições diferentes, uma por rodada, iguais para os dois competidores', () => {
        const mode = createBeteMode()
        const r0 = mode.buildRound(0, 'bot')
        const r1 = mode.buildRound(1, 'bot')
        const r2 = mode.buildRound(2, 'bot')
        const alvo = (campo: ReturnType<typeof mode.buildRound>) => campo[1].pos
        expect(alvo(r0)).not.toEqual(alvo(r1))
        expect(alvo(r1)).not.toEqual(alvo(r2))
        expect(alvo(r0)).not.toEqual(alvo(r2))
        // Mesma posição para a meta e para o bot dentro da rodada.
        expect(mode.buildRound(0, 'target')[1].pos).toEqual(alvo(r0))
    })

    it('depois de um tiro errado a bolinha de tiro volta ao ponto de partida e o alvo à posição da rodada', () => {
        const mode = createBeteMode()
        const inicial = mode.buildRound(0, 'target')
        // Erra de propósito: dispara e avalia um campo deslocado.
        const deslocado = [
            { ...inicial[0], pos: { x: 400, y: 120 }, vel: { x: 0, y: 0 } },
            { ...inicial[1], pos: { x: 500, y: 450 }, vel: { x: 0, y: 0 } },
        ]
        const avaliacao = mode.evaluate({
            field: deslocado,
            contactsInRound: [],
            competitor: 'player',
            shotsSpent: 1,
            opponent: 'target',
        })
        expect(avaliacao.outcome).toBeNull()
        expect(avaliacao.field?.[0].pos).toEqual(inicial[0].pos)
        expect(avaliacao.field?.[1].pos).toEqual(inicial[1].pos)
    })
})

describe('modo Bete: contra o bot', () => {
    /** Joga uma partida inteira contra o bot com fontes dadas e devolve resultados. */
    function partidaBot(jogadorAcerta: (round: number, tiro: number) => boolean, botAcerta: (round: number, tiro: number) => boolean) {
        const mode = createBeteMode()
        // Rastreia rodada corrente por leitura de match.currentRound() no fechamento.
        let match: ReturnType<typeof createMatch>
        const fonte = (quemAcerta: (round: number, tiro: number) => boolean): ShotSource => {
            const porRodada: Record<number, number> = {}
            return {
                nextShot(field) {
                    const r = match.currentRound()
                    porRodada[r] = (porRodada[r] ?? 0) + 1
                    return fonteBete({ acerta: quemAcerta(r, porRodada[r]) }).nextShot(field)
                },
            }
        }
        match = createMatch({
            mode,
            opponent: 'bot',
            sources: { player: fonte(jogadorAcerta), bot: fonte(botAcerta) },
            physics: DEFAULT_PHYSICS,
        })
        let guarda = 0
        while (!match.finished() && guarda++ < 5000) match.nextStep()
        return match.roundOutcomes()
    }

    it('quem começa acerta e o outro erra no mesmo tiro: quem acertou vence', () => {
        const nunca = () => false
        // Rodada 0 (jogador começa): o jogador acerta no 1º tiro e o bot erra o dele.
        const rodadas = partidaBot((r, t) => r === 0 && t === 1, nunca)
        expect(rodadas[0]).toBe('win')
    })

    it('o outro competidor sempre recebe o tiro de igual número, mesmo depois do acerto de quem começou', () => {
        let tirosBot = 0
        let match: ReturnType<typeof createMatch>
        const bot: ShotSource = {
            nextShot(field) {
                if (match.currentRound() === 0) tirosBot++
                return fonteBete({ acerta: false }).nextShot(field)
            },
        }
        let tiro = 0
        const jogador: ShotSource = {
            nextShot(field) {
                if (match.currentRound() === 0) tiro++
                return fonteBete({ acerta: tiro === 1 }).nextShot(field)
            },
        }
        match = createMatch({
            mode: createBeteMode(),
            opponent: 'bot',
            sources: { player: jogador, bot },
            physics: DEFAULT_PHYSICS,
        })
        let guarda = 0
        while (match.currentRound() === 0 && !match.finished() && guarda++ < 2000) match.nextStep()
        expect(tirosBot).toBe(1)
        expect(match.roundOutcomes()[0]).toBe('win')
    })

    it('os dois acertam no mesmo número de tiro: a rodada empata, mesmo quem começou acertando antes', () => {
        const rodadas = partidaBot(
            (r, t) => r === 0 && t === 1,
            (r, t) => r === 0 && t === 1,
        )
        expect(rodadas[0]).toBe('draw')
    })

    it('quem começa erra e o outro acerta no mesmo tiro: o outro vence a rodada', () => {
        const nunca = () => false
        const rodadas = partidaBot(nunca, (r, t) => r === 0 && t === 1)
        expect(rodadas[0]).toBe('loss')
    })

    it('acertar em um tiro anterior vence quem acerta só depois', () => {
        // Jogador acerta no 2º tiro; o bot só no 3º: o jogador vence a rodada.
        const rodadas = partidaBot(
            (r, t) => r === 0 && t === 2,
            (r, t) => r === 0 && t === 3,
        )
        expect(rodadas[0]).toBe('win')
    })

    it('na rodada em que o bot começa, o jogador responde com o tiro de igual número', () => {
        // Rodada 1 (bot começa): o bot acerta no 1º tiro; o jogador também: empate.
        const rodadas = partidaBot(
            (r, t) => r === 1 && t === 1,
            (r, t) => r === 1 && t === 1,
        )
        expect(rodadas[1]).toBe('draw')
        // Só o bot acerta: o bot vence a rodada.
        const soBot = partidaBot(() => false, (r, t) => r === 1 && t === 1)
        expect(soBot[1]).toBe('loss')
    })

    it('ninguém acerta em nenhuma rodada: 3 empates', () => {
        const nunca = () => false
        const rodadas = partidaBot(nunca, nunca)
        expect(rodadas).toEqual(['draw', 'draw', 'draw'])
    })
})

describe('modo Bete: partida simulada completa com o bot real', () => {
    it('motor + modo + planejador do bot: o jogador que acerta sempre vence a partida', () => {
        const planner = createBotPlanner(DEFAULT_BOT)
        let match: ReturnType<typeof createMatch>
        // Bot real: mira o alvo (índice 1) a partir do atirador (índice 0), por semente.
        const botReal: ShotSource = {
            nextShot(field) {
                if (!field || field.length < 2) return { x: 0, y: 0 }
                return planner.planShot(field[0].pos, field[1].pos, match.currentRound() * 97 + 7)
            },
        }
        match = createMatch({
            mode: createBeteMode(),
            opponent: 'bot',
            sources: { player: fonteBete({ acerta: true }), bot: botReal },
            physics: DEFAULT_PHYSICS,
        })
        let guarda = 0
        while (!match.finished() && guarda++ < 5000) match.nextStep()
        // O jogador acerta no 1º tiro de cada rodada; começa nas rodadas 0 e 2.
        expect(match.roundOutcomes()).toHaveLength(3)
        expect(match.matchOutcome()).toBe('win')
    })
})

describe('modo Bete: ajuda', () => {
    it('declara helpText não vazio que cita vitória, derrota e empate', () => {
        const mode = createBeteMode()
        expect(mode.helpText.length).toBeGreaterThan(0)
        expect(mode.helpText.toLowerCase()).toContain('vitória')
        expect(mode.helpText.toLowerCase()).toContain('derrota')
        expect(mode.helpText.toLowerCase()).toContain('empate')
        expect(DEFAULT_BETE_MODE.helpText).toBe(mode.helpText)
    })
})
