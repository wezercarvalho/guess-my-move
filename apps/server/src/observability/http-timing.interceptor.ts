import {
    Injectable,
    type CallHandler,
    type ExecutionContext,
    type NestInterceptor,
} from '@nestjs/common'
import { finalize, tap } from 'rxjs'
import { BackendTelemetry } from './backend-telemetry.service.js'

@Injectable()
export class HttpTimingInterceptor implements NestInterceptor {
    constructor(private readonly telemetry: BackendTelemetry) {}
    intercept(context: ExecutionContext, next: CallHandler) {
        if (context.getType() !== 'http') return next.handle()
        const operation = `${context.getClass().name}:${context.getHandler().name}`
        const started = performance.now()
        let failed = false
        return next.handle().pipe(
            tap({
                error: () => {
                    failed = true
                },
            }),
            finalize(() =>
                this.telemetry.record(
                    operation,
                    failed,
                    performance.now() - started,
                ),
            ),
        )
    }
}
