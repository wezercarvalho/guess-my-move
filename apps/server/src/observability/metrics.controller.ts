import { HttpTimingInterceptor } from './http-timing.interceptor.js'
import { createHash, timingSafeEqual } from 'node:crypto'
import {
    Controller,
    Get,
    Headers,
    Inject,
    NotFoundException,
    SerializeOptions,
    UseInterceptors,
    StandardSchemaSerializerInterceptor,
    UnauthorizedException,
} from '@nestjs/common'
import { SERVER_CONFIG, type ServerConfig } from '../server-config.js'
import { BackendMetrics } from '../realtime/backend-metrics.service.js'
import { metricsResponseSchema } from '../contracts/http-definitions.js'

@UseInterceptors(HttpTimingInterceptor, StandardSchemaSerializerInterceptor)
@Controller('api/metrics')
export class MetricsController {
    constructor(
        @Inject(SERVER_CONFIG) private readonly config: ServerConfig,
        private readonly metrics: BackendMetrics,
    ) {}
    @Get()
    @SerializeOptions({ schema: metricsResponseSchema })
    read(@Headers('authorization') authorization?: string) {
        const token = this.config.metricsToken
        if (!token) throw new NotFoundException()
        const expected = createHash('sha256').update(`Bearer ${token}`).digest()
        const received = createHash('sha256')
            .update(authorization ?? '')
            .digest()
        if (!timingSafeEqual(expected, received))
            throw new UnauthorizedException()
        return this.metrics.snapshot()
    }
}
