import { describe, expect, it } from 'vitest'

import {
    DEFAULT_HOLE_CONFIG,
    DEFAULT_HOLE_MODE,
    createHoleMode,
} from '../src/modes/hole/index.js'
import { type Body, DEFAULT_PHYSICS } from '../src/physics.js'
import { speedToStop } from '../src/bot/index.js'
import { createMatch } from '../src/match/index.js'

const cfg = DEFAULT_HOLE_CONFIG

/** Monta um campo com a bolinha de tiro numa posição e velocidade dadas. */
const ball = (x: number, y: number, vx = 0, vy = 0): Body => ({
    pos: { x, y },
    vel: { x: vx, y: vy },
    radius: cfg.marbleRadius,
})

describe('modo Cova: entrada por velocidade', () => {
    it('entra quando o centro está dentro do raio e a velocidade é menor que o limite; a próxima cova fica ativa', () => {
        const mode = createHoleMode()
        const layout = mode.buildRound(0, 'target')
        const cova0 = cfg.layouts[0][0]
        // Bolinha sobre a cova 0, lenta (abaixo do limite de entrada).
        const campo = [ball(cova0.x, cova0.y, 50, 0)]
        const depois = mode.onStep?.(campo, 'player', 'target')
        expect(depois).toBeDefined()
        // Parou fixada no centro da cova.
        expect(depois![0].pos.x).toBeCloseTo(cova0.x, 6)
        expect(depois![0].pos.y).toBeCloseTo(cova0.y, 6)
        expect(Math.hypot(depois![0].vel.x, depois![0].vel.y)).toBe(0)
        expect(mode.activeHole('player')).toBe(1)
        void layout
    })

    it('acima do limite de velocidade passa sem entrar', () => {
        const mode = createHoleMode()
        mode.buildRound(0, 'target')
        const cova0 = cfg.layouts[0][0]
        const campo = [ball(cova0.x, cova0.y, cfg.entrySpeed + 50, 0)]
        const depois = mode.onStep?.(campo, 'player', 'target')
        // Não entrou: nenhuma substituição de campo e a cova ativa segue 0.
        expect(depois).toBeUndefined()
        expect(mode.activeHole('player')).toBe(0)
    })

    it('a bolinha parada dentro da cova ativa entra', () => {
        const mode = createHoleMode()
        mode.buildRound(0, 'target')
        const cova0 = cfg.layouts[0][0]
        const campo = [ball(cova0.x, cova0.y, 0, 0)]
        const depois = mode.onStep?.(campo, 'player', 'target')
        expect(depois).toBeDefined()
        expect(mode.activeHole('player')).toBe(1)
    })

    it('uma cova que não é a ativa não captura', () => {
        const mode = createHoleMode()
        mode.buildRound(0, 'target')
        const cova1 = cfg.layouts[0][1] // cova 1 ainda não está ativa
        const campo = [ball(cova1.x, cova1.y, 10, 0)]
        const depois = mode.onStep?.(campo, 'player', 'target')
        expect(depois).toBeUndefined()
        expect(mode.activeHole('player')).toBe(0)
    })
})

describe('modo Cova: a bolinha permanece onde parou', () => {
    it('o campo persistido após um tiro mantém a bolinha na posição de repouso', () => {
        const mode = createHoleMode()
        mode.buildRound(0, 'target')
        const paradaLonge = [ball(300, 500, 0, 0)]
        const av = mode.evaluate({
            field: paradaLonge,
            contactsInRound: [],
            competitor: 'player',
            shotsSpent: 1,
            opponent: 'target',
        })
        expect(av.field?.[0].pos).toEqual({ x: 300, y: 500 })
        expect(av.yield).toBe(0)
    })
})

describe('modo Cova: layouts por rodada', () => {
    it('cada uma das 3 rodadas usa um percurso diferente, igual para os dois competidores', () => {
        const mode = createHoleMode()
        const r0 = mode.buildRound(0, 'bot')
        const r0Target = mode.buildRound(0, 'target')
        expect(cfg.layouts).toHaveLength(3)
        expect(cfg.layouts[0]).not.toEqual(cfg.layouts[1])
        expect(cfg.layouts[1]).not.toEqual(cfg.layouts[2])
        // A posição inicial da bolinha é a mesma para os dois adversários.
        expect(r0[0].pos).toEqual(r0Target[0].pos)
    })
})

describe('modo Cova: ponto de chegada do bot', () => {
    it('é o centro da cova ativa', () => {
        const mode = createHoleMode()
        mode.buildRound(0, 'bot')
        expect(mode.botAimPoint('opponent')).toEqual(cfg.layouts[0][0])
    })
})

describe('modo Cova: resultado contra o bot', () => {
    it('quem completou vence quem não completou; menos tiros vence se os dois completaram; mais covas vence se nenhum completou', () => {
        const mode = createHoleMode()
        // (completou, tiros, covas) para jogador e bot.
        expect(mode.resolveBotRound({ done: true, shots: 7, holes: 3 }, { done: false, shots: 9, holes: 2 })).toBe('win')
        expect(mode.resolveBotRound({ done: false, shots: 9, holes: 1 }, { done: true, shots: 8, holes: 3 })).toBe('loss')
        expect(mode.resolveBotRound({ done: true, shots: 7, holes: 3 }, { done: true, shots: 9, holes: 3 })).toBe('win')
        expect(mode.resolveBotRound({ done: true, shots: 7, holes: 3 }, { done: true, shots: 7, holes: 3 })).toBe('draw')
        expect(mode.resolveBotRound({ done: false, shots: 9, holes: 2 }, { done: false, shots: 9, holes: 1 })).toBe('win')
        expect(mode.resolveBotRound({ done: false, shots: 9, holes: 1 }, { done: false, shots: 9, holes: 1 })).toBe('draw')
    })
})

describe('modo Cova: contra a meta (partida simulada completa)', () => {
    /** Fonte que mira o centro da cova ativa com a velocidade que para nela (ferramenta do bot). */
    function fonteCompleta(mode: ReturnType<typeof createHoleMode>): { nextShot: (field?: readonly Body[]) => { x: number; y: number } | null } {
        return {
            nextShot(field) {
                if (!field) return { x: 0, y: 0 }
                const alvo = mode.botAimPoint('player')
                return speedToStop(field[0].pos, alvo, DEFAULT_PHYSICS, cfg.marbleRadius)
            },
        }
    }

    it('completar as 3 covas cedo é vitória e encerra a rodada', () => {
        const mode = createHoleMode()
        const match = createMatch({
            mode,
            opponent: 'target',
            sources: { player: fonteCompleta(mode) },
            physics: DEFAULT_PHYSICS,
        })
        let guarda = 0
        while (match.currentRound() === 0 && !match.finished() && guarda++ < 5000) match.nextStep()
        expect(match.roundOutcomes()[0]).toBe('win')
        expect(match.shotsSpentInPreviousRound()).toBeLessThanOrEqual(cfg.winShots)
    })

    it('9 tiros sem completar é derrota', () => {
        const mode = createHoleMode()
        const match = createMatch({
            mode,
            opponent: 'target',
            // Tiro que nunca chega à cova (vai para o canto oposto, devagar).
            sources: { player: { nextShot: () => ({ x: -40, y: -40 }) } },
            physics: DEFAULT_PHYSICS,
        })
        let guarda = 0
        while (match.currentRound() === 0 && !match.finished() && guarda++ < 5000) match.nextStep()
        expect(match.roundOutcomes()[0]).toBe('loss')
    })
})

describe('modo Cova: ajuda', () => {
    it('declara helpText não vazio que cita vitória, derrota e empate', () => {
        const mode = createHoleMode()
        expect(mode.helpText.toLowerCase()).toContain('vitória')
        expect(mode.helpText.toLowerCase()).toContain('derrota')
        expect(mode.helpText.toLowerCase()).toContain('empate')
        expect(DEFAULT_HOLE_MODE.helpText).toBe(mode.helpText)
    })
})

describe('modo Cova: contra o bot, quem completou sai da disputa', () => {
    /** Mira o centro da cova ativa de um competidor com a velocidade que para nela. */
    function fonteDe(mode: ReturnType<typeof createHoleMode>, competitor: 'player' | 'opponent') {
        return {
            nextShot(field?: readonly Body[]) {
                if (!field) return { x: 0, y: 0 }
                return speedToStop(field[0].pos, mode.botAimPoint(competitor), DEFAULT_PHYSICS, cfg.marbleRadius)
            },
        }
    }

    it('o jogador que completou não recebe mais vez nem tem a contagem de tiros inflada', () => {
        const mode = createHoleMode()
        // O bot desperdiça o primeiro tiro e depois acerta as covas: completa em 4 tiros, o jogador em 3.
        const perfeito = fonteDe(mode, 'opponent')
        let tiros = 0
        const bot = {
            nextShot(field?: readonly Body[]) {
                tiros++
                return tiros === 1 ? { x: 0, y: 0 } : perfeito.nextShot(field)
            },
        }
        const match = createMatch({
            mode,
            opponent: 'bot',
            sources: { player: fonteDe(mode, 'player'), bot },
            physics: DEFAULT_PHYSICS,
        })
        let guarda = 0
        while (match.currentRound() === 0 && !match.finished() && guarda++ < 5000) match.nextStep()
        // 3 tiros contra 4 do bot: vitória por menos tiros (com a contagem inflada seria empate).
        expect(match.roundOutcomes()[0]).toBe('win')
    })

    it('o rendimento de cada tiro é só as covas feitas naquele tiro', () => {
        const mode = createHoleMode()
        const match = createMatch({
            mode,
            opponent: 'target',
            sources: { player: fonteDe(mode, 'player') },
            physics: DEFAULT_PHYSICS,
        })
        let guarda = 0
        while (match.currentRound() === 0 && !match.finished() && guarda++ < 5000) match.nextStep()
        expect(match.yieldOf('player')).toBe(cfg.holesPerRound)
    })
})
