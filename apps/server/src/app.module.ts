import { CardsModule } from './cards/cards.module.js'
import { RuntimeConfigModule } from './runtime-config.module.js'
import { ObservabilityModule } from './observability/observability.module.js'
import { HttpTimingInterceptor } from './observability/http-timing.interceptor.js'
import { MetricsController } from './observability/metrics.controller.js'
import { ApiController } from './contracts/api.controller.js'
import { Module } from '@nestjs/common'

import { HealthController } from './health/health.controller.js'
import { MarblesMultiplayerModule } from './multiplayer/marbles.module.js'
import { RealtimeModule } from './realtime/realtime.module.js'
import { SwingMultiplayerModule } from './swing/swing.module.js'

@Module({
    imports: [
        CardsModule,
        RuntimeConfigModule,
        ObservabilityModule,
        RealtimeModule,
        MarblesMultiplayerModule,
        SwingMultiplayerModule,
    ],
    controllers: [HealthController, ApiController, MetricsController],
    providers: [HttpTimingInterceptor],
})
export class AppModule {}
