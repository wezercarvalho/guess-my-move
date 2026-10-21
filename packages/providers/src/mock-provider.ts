import type {
    GuesserInput,
    GuesserProvider,
    GuesserResult,
} from '@guess-my-move/core'

/** Erro simulado pelo mock para exercitar o caminho de falha do servidor. */
export class MockProviderError extends Error {
    constructor(message = 'falha simulada do provedor mock') {
        super(message)
        this.name = 'MockProviderError'
    }
}

/**
 * Opções do provedor simulado. Tudo é determinístico e sem credencial: o mock
 * existe para rodar a suíte e o fluxo completo sem custo de inferência.
 */
export interface MockGuesserOptions {
    /** Palpite fixo devolvido quando não há erro nem evidência insuficiente. */
    guess?: string
    /** Quando true, devolve `insufficientEvidence: true`. */
    insufficientEvidence?: boolean
    /** Quando definido, a chamada rejeita com este erro. */
    error?: Error
    /** Atraso artificial (ms) para exercitar timeout e cancelamento. */
    delayMs?: number
}

const DEFAULT_GUESS = 'acenar'

/**
 * Provedor de adivinhação simulado. Não contata nenhuma rede nem lê nenhuma
 * credencial. Respeita o `AbortSignal` para que o timeout do servidor funcione
 * mesmo contra o mock.
 */
export class MockGuesserProvider implements GuesserProvider {
    readonly id = 'mock'

    constructor(private readonly options: MockGuesserOptions = {}) {}

    async guess(
        input: GuesserInput,
        signal?: AbortSignal,
    ): Promise<GuesserResult> {
        if (signal?.aborted) {
            throw toAbortError(signal)
        }
        const delayMs = this.options.delayMs ?? 0
        if (delayMs > 0) {
            await this.sleep(delayMs, signal)
        }
        if (this.options.error) {
            throw this.options.error
        }
        // Palpite determinístico: nunca depende do conteúdo dos frames nem de
        // qualquer dado de carta (que a entrada não contém, por contrato).
        void input
        if (this.options.insufficientEvidence) {
            return { guess: this.options.guess ?? '', insufficientEvidence: true }
        }
        return { guess: this.options.guess ?? DEFAULT_GUESS }
    }

    private sleep(ms: number, signal?: AbortSignal): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => {
                signal?.removeEventListener('abort', onAbort)
                resolve()
            }, ms)
            const onAbort = (): void => {
                clearTimeout(timer)
                reject(toAbortError(signal))
            }
            if (signal) {
                signal.addEventListener('abort', onAbort, { once: true })
            }
        })
    }
}

function toAbortError(signal?: AbortSignal): Error {
    const reason: unknown = signal?.reason
    if (reason instanceof Error) {
        return reason
    }
    const error = new Error('operação cancelada')
    error.name = 'AbortError'
    return error
}
