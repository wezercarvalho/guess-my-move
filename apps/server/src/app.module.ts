import { RuntimeConfigModule } from './runtime-config.module.js'
import { ObservabilityModule } from './observability/observability.module.js'
import { HttpTimingInterceptor } from './observability/http-timing.interceptor.js'
import { MetricsController } from './observability/metrics.controller.js'
import { ApiController } from './contracts/api.controller.js'
import { Module } from '@nestjs/common'

import { HealthController } from './health/health.controller.js'
import { MultiplayerGateway } from './multiplayer/multiplayer.gateway.js'
import { RoomService } from './multiplayer/room.service.js'
import { SERVER_CONFIG, type ServerConfig } from './server-config.js'

@Module({
    imports: [RuntimeConfigModule, ObservabilityModule],
    controllers: [HealthController, ApiController, MetricsController],
    providers: [
        // Interceptores HTTP pertencem aos controllers: não envolver eventos Socket.IO.
        HttpTimingInterceptor,
        {
            provide: RoomService,
            inject: [SERVER_CONFIG],
            useFactory: (config: ServerConfig): RoomService =>
                new RoomService({
                    maxRooms: config.maxRooms,
                    waitingTimeoutMs: config.waitingTimeoutMs,
                    idleTimeoutMs: config.idleTimeoutMs,
                    finishedTimeoutMs: config.finishedTimeoutMs,
                }),
        },
        MultiplayerGateway,
    ],
})
export class AppModule {}
