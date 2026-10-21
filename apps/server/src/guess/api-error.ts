import type { ApiError, ApiErrorCode } from '@guess-my-move/core'
import {
    type ArgumentsHost,
    Catch,
    type ExceptionFilter,
    HttpException,
    HttpStatus,
} from '@nestjs/common'

/** Interface mínima da resposta HTTP, para não depender de `@types/express`. */
interface HttpResponseLike {
    status(code: number): HttpResponseLike
    json(body: unknown): unknown
}

/** Mapa de código estável de erro para status HTTP. */
const STATUS_BY_CODE: Record<ApiErrorCode, HttpStatus> = {
    invalid_payload: HttpStatus.BAD_REQUEST,
    payload_too_large: HttpStatus.PAYLOAD_TOO_LARGE,
    rate_limited: HttpStatus.TOO_MANY_REQUESTS,
    provider_timeout: HttpStatus.GATEWAY_TIMEOUT,
    provider_error: HttpStatus.BAD_GATEWAY,
    invalid_model_response: HttpStatus.BAD_GATEWAY,
    cost_limit_reached: HttpStatus.TOO_MANY_REQUESTS,
}

const RETRYABLE: ReadonlySet<ApiErrorCode> = new Set<ApiErrorCode>([
    'rate_limited',
    'provider_timeout',
    'provider_error',
    'cost_limit_reached',
])

/**
 * Erro estável da API. Carrega apenas um código, uma mensagem segura e o flag
 * `retryable`; nunca expõe detalhes internos do provedor. A causa interna fica
 * em `internalCause` para log técnico (sem mídia), não para a resposta.
 */
export class ApiException extends HttpException {
    readonly code: ApiErrorCode
    readonly retryable: boolean
    readonly internalCause?: unknown

    constructor(code: ApiErrorCode, message: string, internalCause?: unknown) {
        const body: ApiError = {
            error: { code, message, retryable: RETRYABLE.has(code) },
        }
        super(body, STATUS_BY_CODE[code])
        this.code = code
        this.retryable = RETRYABLE.has(code)
        this.internalCause = internalCause
    }
}

/**
 * Converte qualquer falha em um corpo `ApiError` estável. Um erro inesperado
 * vira `provider_error` genérico, sem vazar a mensagem interna ao cliente.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost): void {
        const response = host.switchToHttp().getResponse<HttpResponseLike>()
        if (exception instanceof ApiException) {
            response
                .status(exception.getStatus())
                .json(exception.getResponse())
            return
        }
        const fallback: ApiError = {
            error: {
                code: 'provider_error',
                message: 'erro interno ao processar a tentativa',
                retryable: true,
            },
        }
        response.status(HttpStatus.BAD_GATEWAY).json(fallback)
    }
}
