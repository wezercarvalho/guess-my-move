/**
 * Contratos compartilhados da PoC Guess My Move.
 *
 * Este pacote contém SOMENTE tipos e contratos (sem lógica, sem I/O). As
 * implementações (carta, árbitro, motor, adaptadores do provedor) chegam nas
 * issues seguintes. A fronteira de informação é inviolável: a IA adivinhadora
 * nunca recebe a carta — nem palavra, dica, sugestão, aliases ou critérios.
 */

/**
 * Frame capturado da webcam, transitório por natureza: nunca persistido e
 * nunca registrado em log. `data` é base64 sem o prefixo `data:`.
 */
export interface CapturedFrame {
    timestampMs: number
    mimeType: string
    data: string
}

/**
 * Entrada enviada ao adivinhador. Contém apenas os frames e, opcionalmente, os
 * palpites já rejeitados na rodada. NÃO contém nenhum dado da carta.
 */
export interface GuesserInput {
    frames: CapturedFrame[]
    rejectedGuesses?: string[]
}

/** Resultado do adivinhador: um único palpite curto. */
export interface GuesserResult {
    guess: string
    insufficientEvidence?: boolean
}

/**
 * Adaptador de um provedor de adivinhação. Cada provedor (mock, codex, ...) é
 * selecionado por configuração e implementa este contrato.
 */
export interface GuesserProvider {
    readonly id: string
    guess(input: GuesserInput, signal?: AbortSignal): Promise<GuesserResult>
}

/** Parte pública da carta: o que o jogador vê. */
export interface CardPublic {
    word: string
    hint: string
    suggestion: string
    difficulty?: string
}

/**
 * Metadados de avaliação da carta. NUNCA saem do servidor/motor e NUNCA vão ao
 * adivinhador: resposta canônica, aliases aceitos, palpites insuficientes e
 * critérios visuais futuros.
 */
export interface CardEvaluation {
    canonicalAnswer: string
    acceptedAliases: string[]
    insufficientGuesses: string[]
    /**
     * Palpites conhecidamente ambíguos: nem claramente corretos, nem claramente
     * insuficientes. O árbitro determinístico os devolve como `undetermined`
     * para que o fallback opcional por LLM (#14) decida de forma conservadora.
     */
    ambiguousGuesses?: string[]
    visualCriteria?: string[]
}

/** Carta completa: identidade, locale, parte pública e avaliação privada. */
export interface Card {
    id: string
    locale: string
    public: CardPublic
    evaluation: CardEvaluation
}

/** Códigos de erro estáveis expostos pela API. */
export type ApiErrorCode =
    | 'invalid_payload'
    | 'payload_too_large'
    | 'rate_limited'
    | 'provider_timeout'
    | 'provider_error'
    | 'invalid_model_response'
    | 'cost_limit_reached'

/**
 * Formato de erro estável da API. Nunca expõe detalhes internos do provedor.
 */
export interface ApiError {
    error: {
        code: ApiErrorCode
        message: string
        retryable: boolean
    }
}
