import { HttpTimingInterceptor } from '../observability/http-timing.interceptor.js'
import {
    Controller,
    Get,
    SerializeOptions,
    UseInterceptors,
    StandardSchemaSerializerInterceptor,
} from '@nestjs/common'

import { healthResponseSchema } from '../contracts/http-definitions.js'

@UseInterceptors(HttpTimingInterceptor, StandardSchemaSerializerInterceptor)
@Controller('api/health')
export class HealthController {
    @Get()
    @SerializeOptions({ schema: healthResponseSchema })
    check(): { status: 'ok' } {
        return { status: 'ok' }
    }
}
