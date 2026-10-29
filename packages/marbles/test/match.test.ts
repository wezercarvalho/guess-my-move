import { describe, expect, it } from 'vitest'

import matchSource from '../src/match/index.ts?raw'
import { type Body, DEFAULT_PHYSICS } from '../src/physics.js'
import {
    type Adversario,
    type FonteDeTiro,
    type Modo,
    type ResultadoDaRodada,
    createMatch,
} from '../src/match/index.js'

const bola = (x: number, vx = 0): Body => ({ pos: { x, y: 300 }, vel: { x: vx, y: 0 }, radius: 14 })

/** Fonte de tiro que devolve, em ordem, os vetores de velocidade dados; depois disso, parada. */
function fonteFixa(...vels: { x: number; y: number }[]): FonteDeTiro {
    let i = 0
    return {
        proximoTiro() {
            return i < vels.length ? vels[i++] : null
        },
    }
}

/**
 * Modo de teste do bete: uma bolinha de tiro (índice 0) e um alvo (índice 1).
 * Acerto = contato. Avaliação pede ao modo; a vez alterna por padrão.
 */
function modoBeteTeste(opts: { limiteMeta?: number; limiteBot?: number } = {}): Modo {
    const limiteMeta = opts.limiteMeta ?? 5
    const limiteBot = opts.limiteBot ?? 5
    return {
        nome: 'bete-teste',
        textoDeAjuda: 'Acerte o alvo. Vitória ao acertar cedo; empate tarde; derrota sem acertar.',
        rodadasPorPartida: 3,
        montarRodada() {
            return [bola(150), bola(550)]
        },
        limiteDeTiros(_competidor, adversario) {
            return adversario === 'meta' ? limiteMeta : limiteBot
        },
        avaliar(contexto) {
            const acertou = contexto.contatosNaRodada.some(([a, b]) => a === 0 && b === 1)
            if (acertou) {
                return { rendeu: 1, terminou: true, resultado: 'vitoria' }
            }
            return { rendeu: 0, terminou: false, resultado: null }
        },
    }
}

/** Modo de teste que mantém a vez quando o tiro rendeu (como o triângulo). */
function modoMantemVez(): Modo {
    return {
        nome: 'mantem-teste',
        textoDeAjuda: 'Capture para manter a vez. Mais capturas vence; iguais empatam; menos perde.',
        rodadasPorPartida: 1,
        montarRodada() {
            return [bola(150)]
        },
        limiteDeTiros() {
            return 4
        },
        avaliar(contexto) {
            // "Rende" quando o tiro foi forte (vx != 0 deixou a bolinha longe do início).
            const rendeu = contexto.campo[0].pos.x > 300 ? 1 : 0
            return { rendeu, terminou: false, resultado: null }
        },
        proximaVez(padraoAlterna, rendeu) {
            return rendeu > 0 ? 'mantem' : padraoAlterna
        },
    }
}

/** Joga a partida inteira com as fontes dadas e devolve os resultados por rodada. */
function jogar(
    modo: Modo,
    adversario: Adversario,
    fontes: { jogador: FonteDeTiro; bot?: FonteDeTiro },
): { rodadas: ResultadoDaRodada[]; resultado: ResultadoDaRodada } {
    const match = createMatch({ modo, adversario, fontes, physics: DEFAULT_PHYSICS })
    let guarda = 0
    while (!match.terminou() && guarda++ < 1000) {
        match.proximoPasso()
    }
    return { rodadas: match.resultadosDasRodadas(), resultado: match.resultadoDaPartida() }
}

describe('motor de partida: resultado da partida', () => {
    it('2 vitórias e 1 derrota = vitória; 1-1-1 = empate; 3 empates = empate; 1 vitória e 2 derrotas = derrota', () => {
        const calc = (rodadas: ResultadoDaRodada[]): ResultadoDaRodada => {
            const match = createMatch({
                modo: modoBeteTeste(),
                adversario: 'meta',
                fontes: { jogador: fonteFixa() },
                physics: DEFAULT_PHYSICS,
            })
            return match.computarResultado(rodadas)
        }
        expect(calc(['vitoria', 'vitoria', 'derrota'])).toBe('vitoria')
        expect(calc(['vitoria', 'empate', 'derrota'])).toBe('empate')
        expect(calc(['empate', 'empate', 'empate'])).toBe('empate')
        expect(calc(['vitoria', 'derrota', 'derrota'])).toBe('derrota')
    })
})

describe('motor de partida: contra a meta', () => {
    it('o jogador atira sempre que as bolinhas param; acertar cedo vence a rodada', () => {
        // Tiro forte rumo ao alvo (à esquerda do shooter): velocidade negativa? alvo está à direita.
        const { resultado } = jogar(modoBeteTeste(), 'meta', { jogador: fonteFixa({ x: 2000, y: 0 }, { x: 2000, y: 0 }, { x: 2000, y: 0 }) })
        expect(resultado).toBe('vitoria')
    })

    it('esgotar os tiros sem acertar não prende a rodada e dá derrota', () => {
        const { rodadas } = jogar(modoBeteTeste({ limiteMeta: 2 }), 'meta', {
            jogador: fonteFixa({ x: 0, y: -100 }, { x: 0, y: -100 }, { x: 0, y: -100 }, { x: 0, y: -100 }, { x: 0, y: -100 }, { x: 0, y: -100 }),
        })
        expect(rodadas).toHaveLength(3)
        for (const r of rodadas) expect(r).toBe('derrota')
    })

    it('uma vitória decidida encerra a rodada sem consumir os tiros restantes', () => {
        const match = createMatch({
            modo: modoBeteTeste({ limiteMeta: 5 }),
            adversario: 'meta',
            fontes: { jogador: fonteFixa({ x: 2000, y: 0 }) },
            physics: DEFAULT_PHYSICS,
        })
        while (match.rodadaAtual() === 0 && !match.terminou()) match.proximoPasso()
        expect(match.tirosGastosNaRodadaAnterior()).toBe(1)
    })
})

describe('motor de partida: contra o bot', () => {
    it('o jogador começa a rodada 1 e a ordem alterna por rodada', () => {
        const match = createMatch({
            modo: modoBeteTeste(),
            adversario: 'bot',
            fontes: { jogador: fonteFixa({ x: 0, y: -50 }), bot: fonteFixa({ x: 0, y: -50 }) },
            physics: DEFAULT_PHYSICS,
        })
        expect(match.comecaRodada(0)).toBe('jogador')
        expect(match.comecaRodada(1)).toBe('bot')
        expect(match.comecaRodada(2)).toBe('jogador')
    })

    it('contra a meta não há vez (sempre o jogador)', () => {
        const match = createMatch({
            modo: modoBeteTeste(),
            adversario: 'meta',
            fontes: { jogador: fonteFixa() },
            physics: DEFAULT_PHYSICS,
        })
        expect(match.comecaRodada(0)).toBe('jogador')
        expect(match.comecaRodada(1)).toBe('jogador')
    })
})

describe('contrato de modo: vez', () => {
    it('o modo que mantém a vez após render não passa a vez; o padrão alterna', () => {
        const alterna = modoBeteTeste()
        const vezAlterna = alterna.proximaVez
            ? alterna.proximaVez('bot', 0)
            : 'bot'
        expect(vezAlterna).toBe('bot')

        const mantem = modoMantemVez()
        expect(mantem.proximaVez?.('bot', 1)).toBe('mantem')
        expect(mantem.proximaVez?.('bot', 0)).toBe('bot')
    })
})

describe('fonte do tiro e cadeia', () => {
    it('o efeito em cadeia é atribuído ao competidor do tiro corrente', () => {
        // Modo de 3 bolinhas: o tiro (0) empurra (1), que empurra (2) para fora; a captura é do atirador.
        const modoCadeia: Modo = {
            nome: 'cadeia-teste',
            textoDeAjuda: 'Empurre em cadeia. Vitória ao capturar; empate/derrota conforme as capturas.',
            rodadasPorPartida: 1,
            montarRodada() {
                return [bola(150), bola(300), bola(320)]
            },
            limiteDeTiros() {
                return 1
            },
            avaliar(contexto) {
                // Captura = bolinha que saiu pela direita do campo (x perto da parede).
                const capturas = contexto.campo.filter((b, i) => i > 0 && b.pos.x > 700).length
                return { rendeu: capturas, terminou: capturas > 0, resultado: capturas > 0 ? 'vitoria' : 'derrota' }
            },
        }
        const match = createMatch({
            modo: modoCadeia,
            adversario: 'meta',
            fontes: { jogador: fonteFixa({ x: 3000, y: 0 }) },
            physics: DEFAULT_PHYSICS,
        })
        let guarda = 0
        while (!match.terminou() && guarda++ < 1000) match.proximoPasso()
        expect(match.capturasDe('jogador')).toBeGreaterThan(0)
    })

    it('determinismo: a mesma sequência de tiros produz o mesmo resultado', () => {
        const run = () =>
            jogar(modoBeteTeste({ limiteMeta: 3 }), 'meta', {
                jogador: fonteFixa({ x: 0, y: -80 }, { x: 2000, y: 0 }, { x: 2000, y: 0 }),
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

