/**
 * Motor de partida puro e determinístico. Conduz uma partida de várias rodadas
 * sobre um contrato de modo: registra o competidor do tiro corrente, avança a
 * física até o repouso, pede ao modo a avaliação do campo e decide a próxima
 * vez e o resultado. Não conhece a geometria de nenhum modo, não importa DOM,
 * MediaPipe nem relógio: o acaso e o tempo entram pelo modo e pelas fontes de
 * tiro. A física (`stepBodies`, `isAtRest`) é reaproveitada intacta.
 */
import { type Body, DEFAULT_PHYSICS, type PhysicsConfig, isAtRest, stepBodies } from '../physics.js'

/** O jogador ou o adversário automático. */
export type Competidor = 'jogador' | 'bot'

/** Quem o jogador enfrenta: a meta (solo, sem vez) ou o bot (dois competidores com vez). */
export type Adversario = 'meta' | 'bot'

/** Resultado de uma rodada ou da partida, do ponto de vista do jogador. */
export type ResultadoDaRodada = 'vitoria' | 'empate' | 'derrota'

/** Decisão de vez devolvida pelo modo: alterna, ou mantém com o competidor atual. */
export type ProximaVez = Competidor | 'mantem'

/** Contexto que o motor entrega ao modo para avaliar o campo em repouso. */
export interface ContextoDeAvaliacao {
    /** O campo em repouso (corpos restantes) após o tiro. */
    campo: readonly Body[]
    /** Pares `[i, j]` em contato acumulados durante toda a rolagem deste tiro. */
    contatosNaRodada: readonly (readonly [number, number])[]
    /** Quem deu o tiro corrente. */
    competidor: Competidor
    /** Tiros já gastos por este competidor nesta rodada, incluindo o corrente. */
    tirosGastos: number
    /** Adversário desta partida. */
    adversario: Adversario
}

/** O que o tiro rendeu e se a rodada terminou. */
export interface Avaliacao {
    /** Quanto o tiro rendeu ao competidor do tiro (acertos, capturas, covas). */
    rendeu: number
    /** `true` quando a rodada terminou por decisão do modo (encerra sem gastar tiros restantes). */
    terminou: boolean
    /** Resultado da rodada quando ela terminou por decisão do modo; `null` enquanto não terminou. */
    resultado: ResultadoDaRodada | null
}

/**
 * Contrato que cada modo implementa. Declara só o que Bete, Triângulo e Cova
 * precisam: montar o campo, o limite de tiros por competidor e adversário, a
 * avaliação do campo em repouso e, opcionalmente, de quem é a próxima vez.
 */
export interface Modo {
    nome: string
    /** Ajuda não vazia, que cita vitória, derrota e empate. */
    textoDeAjuda: string
    /** Quantas rodadas tem a partida (padrão de produto: 3). */
    rodadasPorPartida: number
    /** Campo inicial da rodada `n` (0..rodadasPorPartida-1) para o adversário dado. */
    montarRodada(n: number, adversario: Adversario): Body[]
    /** Limite de tiros do competidor por adversário. */
    limiteDeTiros(competidor: Competidor, adversario: Adversario): number
    /** Avalia o campo em repouso após um tiro. */
    avaliar(contexto: ContextoDeAvaliacao): Avaliacao
    /**
     * De quem é a próxima vez. `padraoAlterna` é o outro competidor (a alternância
     * padrão); `rendeu` é o que o tiro corrente rendeu. Ausente = alterna sempre.
     */
    proximaVez?(padraoAlterna: Competidor, rendeu: number): ProximaVez
}

/** Fonte do tiro: entrega o próximo vetor de velocidade, ou `null` quando não há tiro. */
export interface FonteDeTiro {
    /** `campo` é o estado corrente; devolve o tiro ou `null` (sem tiro disponível). */
    proximoTiro(campo?: readonly Body[]): { x: number; y: number } | null
}

export interface MatchConfig {
    modo: Modo
    adversario: Adversario
    fontes: { jogador: FonteDeTiro; bot?: FonteDeTiro }
    physics: PhysicsConfig
    /** Teto de passos de física por rolagem, trava de segurança contra rolagem infinita. */
    maxPassosPorTiro: number
}

export const DEFAULT_MAX_PASSOS_POR_TIRO = 10_000

export interface Match {
    /** Índice da rodada corrente (0..n-1). */
    rodadaAtual(): number
    /** Processa um tiro completo: dispara, rola até o repouso, avalia e avança. */
    proximoPasso(): void
    /** `true` quando todas as rodadas acabaram. */
    terminou(): boolean
    resultadosDasRodadas(): ResultadoDaRodada[]
    resultadoDaPartida(): ResultadoDaRodada
    /** Computa o resultado da partida a partir de resultados de rodada dados (sem jogar). */
    computarResultado(rodadas: readonly ResultadoDaRodada[]): ResultadoDaRodada
    /** Quem começa a rodada `n`: jogador na 1ª contra o bot, alternando; sempre jogador contra a meta. */
    comecaRodada(n: number): Competidor
    /** Tiros gastos na rodada que acabou de encerrar (para provar o encerramento antecipado). */
    tirosGastosNaRodadaAnterior(): number
    /** Total do que o competidor rendeu na partida (capturas/acertos/covas). */
    capturasDe(competidor: Competidor): number
}

/** Resultado da partida: mais rodadas vencidas que perdidas é vitória; menos é derrota; igual é empate. */
export function computarResultadoDaPartida(rodadas: readonly ResultadoDaRodada[]): ResultadoDaRodada {
    const vitorias = rodadas.filter((r) => r === 'vitoria').length
    const derrotas = rodadas.filter((r) => r === 'derrota').length
    if (vitorias > derrotas) return 'vitoria'
    if (vitorias < derrotas) return 'derrota'
    return 'empate'
}

export function createMatch(overrides: Partial<MatchConfig> & Pick<MatchConfig, 'modo' | 'adversario' | 'fontes'>): Match {
    const cfg: MatchConfig = {
        physics: DEFAULT_PHYSICS,
        maxPassosPorTiro: DEFAULT_MAX_PASSOS_POR_TIRO,
        ...overrides,
    }
    const { modo, adversario, fontes } = cfg
    const outro = (c: Competidor): Competidor => (c === 'jogador' ? 'bot' : 'jogador')

    let rodada = 0
    let campo: Body[] = modo.montarRodada(0, adversario)
    let vez: Competidor = comecaRodada(0)
    let tirosGastos: Record<Competidor, number> = { jogador: 0, bot: 0 }
    const resultados: ResultadoDaRodada[] = []
    const rendimento: Record<Competidor, number> = { jogador: 0, bot: 0 }
    let tirosGastosAnterior = 0
    let fim = false

    function comecaRodada(n: number): Competidor {
        if (adversario === 'meta') return 'jogador'
        return n % 2 === 0 ? 'jogador' : 'bot'
    }

    function fonteDe(competidor: Competidor): FonteDeTiro | undefined {
        return competidor === 'jogador' ? fontes.jogador : fontes.bot
    }

    function limiteAtingido(competidor: Competidor): boolean {
        return tirosGastos[competidor] >= modo.limiteDeTiros(competidor, adversario)
    }

    /** `true` quando todos os competidores da rodada esgotaram os tiros. */
    function rodadaEsgotada(): boolean {
        if (adversario === 'meta') return limiteAtingido('jogador')
        return limiteAtingido('jogador') && limiteAtingido('bot')
    }

    /** Rola a física até o repouso, acumulando os contatos de toda a rolagem. */
    function rolarAteRepouso(): (readonly [number, number])[] {
        const contatos: (readonly [number, number])[] = []
        let passos = 0
        while (!isAtRest(campo, cfg.physics) && passos < cfg.maxPassosPorTiro) {
            const resultado = stepBodies(campo, cfg.physics)
            campo = resultado.bodies
            for (const par of resultado.contacts) contatos.push(par)
            passos++
        }
        return contatos
    }

    function proximaVezApos(rendeu: number): Competidor {
        if (adversario === 'meta') return 'jogador'
        const padrao = outro(vez)
        const decisao: ProximaVez = modo.proximaVez ? modo.proximaVez(padrao, rendeu) : padrao
        const alvo: Competidor = decisao === 'mantem' ? vez : decisao
        // Pula quem já esgotou os tiros.
        if (limiteAtingido(alvo) && !limiteAtingido(outro(alvo))) return outro(alvo)
        return alvo
    }

    function encerrarRodada(resultado: ResultadoDaRodada): void {
        resultados.push(resultado)
        tirosGastosAnterior = tirosGastos[vez]
        rodada++
        if (rodada >= modo.rodadasPorPartida) {
            fim = true
            return
        }
        campo = modo.montarRodada(rodada, adversario)
        tirosGastos = { jogador: 0, bot: 0 }
        vez = comecaRodada(rodada)
    }

    function proximoPasso(): void {
        if (fim) return

        // Quem tem a vez mas já esgotou os tiros é pulado; se os dois esgotaram, a rodada fecha.
        if (limiteAtingido(vez)) {
            if (rodadaEsgotada()) {
                encerrarRodada('derrota')
                return
            }
            vez = outro(vez)
            return
        }

        const fonte = fonteDe(vez)
        const tiro = fonte ? fonte.proximoTiro(campo) : null
        if (!tiro) {
            // Sem tiro disponível: se a rodada esgotou, fecha; senão, nada a fazer neste passo.
            if (rodadaEsgotada()) encerrarRodada('derrota')
            else fim = true
            return
        }

        // Dispara: o primeiro corpo é a bolinha de tiro do competidor corrente.
        campo = [{ ...campo[0], vel: { x: tiro.x, y: tiro.y } }, ...campo.slice(1)]
        tirosGastos[vez]++

        const contatosNaRodada = rolarAteRepouso()
        const avaliacao = modo.avaliar({
            campo,
            contatosNaRodada,
            competidor: vez,
            tirosGastos: tirosGastos[vez],
            adversario,
        })
        rendimento[vez] += avaliacao.rendeu

        if (avaliacao.terminou && avaliacao.resultado) {
            encerrarRodada(avaliacao.resultado)
            return
        }
        if (rodadaEsgotada()) {
            encerrarRodada('derrota')
            return
        }
        vez = proximaVezApos(avaliacao.rendeu)
    }

    return {
        rodadaAtual: () => rodada,
        proximoPasso,
        terminou: () => fim,
        resultadosDasRodadas: () => [...resultados],
        resultadoDaPartida: () => computarResultadoDaPartida(resultados),
        computarResultado: (rodadas) => computarResultadoDaPartida(rodadas),
        comecaRodada,
        tirosGastosNaRodadaAnterior: () => tirosGastosAnterior,
        capturasDe: (competidor) => rendimento[competidor],
    }
}
