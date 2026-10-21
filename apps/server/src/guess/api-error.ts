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
 * Status 4xx de falhas do próprio cliente (JSON malformado, corpo grande demais,
 * rota inexistente), vindas do Nest ou do parser HTTP. Devolve `null` para
 * qualquer outra falha, que segue como erro interno genérico.
 */
function clientErrorStatus(exception: unknown): number | null {
    const candidates: unknown[] = []
    if (exception instanceof HttpException) {
        candidates.push(exception.getStatus())
    } else if (typeof exception === 'object' && exception !== null) {
        const record = exception as Record<string, unknown>
        candidates.push(record['status'], record['statusCode'])
    }
    for (const value of candidates) {
        if (typeof value === 'number' && value >= 400 && value < 500) {
            return value
        }
    }
    return null
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
        const clientStatus = clientErrorStatus(exception)
        if (clientStatus !== null) {
            const tooLarge = clientStatus === 413
            const body: ApiError = {
                error: {
                    code: tooLarge ? 'payload_too_large' : 'invalid_payload',
                    message: tooLarge
                        ? 'o corpo da requisição excede o limite permitido'
                        : 'requisição inválida',
                    retryable: false,
                },
            }
            response.status(clientStatus).json(body)
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
