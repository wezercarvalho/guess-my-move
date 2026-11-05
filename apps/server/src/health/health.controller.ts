import { Controller, Get } from '@nestjs/common'

@Controller('api/health')
export class HealthController {
    @Get()
    check(): { status: 'ok' } {
        return { status: 'ok' }
    }
}
