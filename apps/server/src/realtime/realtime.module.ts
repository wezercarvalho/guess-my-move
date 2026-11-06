import { RoomBudget } from './room-budget.service.js'
import { Module } from '@nestjs/common'
import { RuntimeConfigModule } from '../runtime-config.module.js'
import { ObservabilityModule } from '../observability/observability.module.js'
import { RealtimePolicy } from './realtime-policy.service.js'
import { BackendMetrics } from './backend-metrics.service.js'

@Module({
    imports: [RuntimeConfigModule, ObservabilityModule],
    providers: [RealtimePolicy, BackendMetrics, RoomBudget],
    exports: [RealtimePolicy, BackendMetrics, RoomBudget],
})
export class RealtimeModule {}
