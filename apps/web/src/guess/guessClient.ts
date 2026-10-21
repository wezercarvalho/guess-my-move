import {
    type ApiError,
    type GuessResponse as CoreGuessResponse,
    type GuesserInput,
    apiErrorSchema,
    guessResponseSchema,
} from '@guess-my-move/core'

/**
 * Cliente HTTP da rota `POST /api/guess`.
 *
 * O corpo contém SOMENTE os frames e, opcionalmente, os palpites rejeitados —
 * NENHUM dado da carta (palavra, dica, sugestão, aliases, critérios). A carta
 * fica inteiramente no cliente/servidor fora desta chamada; o servidor nem
 * conhece a carta nesta rota.
 */

/** Corpo da requisição ao servidor (contrato do `core`). Sem nenhum dado da carta. */
export type GuessRequest = GuesserInput

/** Resposta de sucesso do servidor (200), validada pelo schema do `core`. */
export type GuessResponse = CoreGuessResponse

/**
 * Erro estável do cliente: embrulha o `ApiError` do servidor, ou sintetiza um
 * código quando a falha é de rede/timeout no próprio cliente.
 */
export class GuessApiError extends Error {
    constructor(
        readonly code: ApiError['error']['code'] | 'network_error' | 'aborted',
        message: string,
        readonly retryable: boolean,
    ) {
        super(message)
        this.name = 'GuessApiError'
    }
}

/** `fetch` injetável para testes. */
export type FetchLike = (
    input: string,
    init?: RequestInit,
) => Promise<Response>

/** Opções do cliente. */
export interface GuessClientOptions {
    fetchImpl?: FetchLike
    endpoint?: string
    /** Timeout do cliente, em ms (padrão 20000). */
    timeoutMs?: number
}

/** Mensagem legível por código estável, para a UI. */
const MESSAGES: Record<string, string> = {
    invalid_payload: 'O envio foi recusado pelo servidor. Tente capturar novamente.',
    payload_too_large:
        'Os frames capturados são grandes demais. Tente novamente com uma captura menor.',
    rate_limited: 'Muitas tentativas em pouco tempo. Aguarde um momento e tente de novo.',
    provider_timeout: 'O provedor demorou demais para responder. Tente novamente.',
    provider_error: 'O provedor de IA falhou nesta tentativa. Tente novamente.',
    invalid_model_response:
        'A resposta do provedor veio em formato inválido. Tente novamente.',
    cost_limit_reached:
        'O limite de uso do provedor foi atingido. Tente mais tarde.',
    network_error: 'Não foi possível falar com o servidor. Verifique a conexão e tente novamente.',
    aborted: 'A tentativa foi cancelada.',
}

/** `true` para códigos que fazem sentido reexecutar automaticamente. */
function isRetryable(code: string): boolean {
    return (
        code === 'provider_timeout' ||
        code === 'provider_error' ||
        code === 'rate_limited' ||
        code === 'network_error'
    )
}

function readableMessage(code: string, fallback: string): string {
    return MESSAGES[code] ?? fallback
}

/**
 * Envia os frames ao servidor e devolve o palpite. Lança `GuessApiError` com
 * código estável em qualquer falha (payload inválido, provedor, rede, timeout,
 * cancelamento). Combina o `signal` externo com um timeout interno.
 */
export async function requestGuess(
    request: GuessRequest,
    options: GuessClientOptions = {},
    externalSignal?: AbortSignal,
): Promise<GuessResponse> {
    const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis)
    const endpoint = options.endpoint ?? '/api/guess'
    const timeoutMs = options.timeoutMs ?? 20_000

    const controller = new AbortController()
    const onExternalAbort = () => controller.abort()
    if (externalSignal) {
        if (externalSignal.aborted) controller.abort()
        else externalSignal.addEventListener('abort', onExternalAbort, { once: true })
    }
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    let response: Response
    try {
        response = await fetchImpl(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                frames: request.frames,
                ...(request.rejectedGuesses && request.rejectedGuesses.length > 0
                    ? { rejectedGuesses: request.rejectedGuesses }
                    : {}),
            }),
            signal: controller.signal,
        })
    } catch (error) {
        clearTimeout(timer)
        externalSignal?.removeEventListener('abort', onExternalAbort)
        // Distingue cancelamento de falha de rede.
        const aborted =
            externalSignal?.aborted ||
            (typeof error === 'object' &&
                error !== null &&
                'name' in error &&
                String(error.name) === 'AbortError')
        if (aborted && externalSignal?.aborted) {
            throw new GuessApiError('aborted', MESSAGES.aborted, false)
        }
        if (aborted) {
            throw new GuessApiError(
                'provider_timeout',
                MESSAGES.provider_timeout,
                true,
            )
        }
        throw new GuessApiError('network_error', MESSAGES.network_error, true)
    }
    clearTimeout(timer)
    externalSignal?.removeEventListener('abort', onExternalAbort)

    if (response.ok) {
        // A resposta é validada pelo contrato compartilhado: um corpo fora do
        // formato vira `invalid_model_response` em vez de dados soltos na UI.
        const parsed = guessResponseSchema.safeParse(
            await response.json().catch(() => null),
        )
        if (!parsed.success) {
            throw new GuessApiError(
                'invalid_model_response',
                MESSAGES.invalid_model_response,
                true,
            )
        }
        return parsed.data
    }

    // Erro estável: lê o corpo ApiError quando possível.
    let code = 'provider_error'
    let message: string | null = null
    let retryable: boolean | null = null
    try {
        const parsed = apiErrorSchema.safeParse(await response.json())
        if (parsed.success) {
            code = parsed.data.error.code
            message = parsed.data.error.message
            retryable = parsed.data.error.retryable
        }
    } catch {
        // Corpo ilegível: mantém o código genérico.
    }

    throw new GuessApiError(
        code as GuessApiError['code'],
        readableMessage(code, message ?? 'Falha ao obter o palpite.'),
        retryable ?? isRetryable(code),
    )
}
