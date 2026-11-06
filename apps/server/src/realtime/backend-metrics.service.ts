import { Injectable } from '@nestjs/common'
import { BackendTelemetry } from '../observability/backend-telemetry.service.js'
import { RoomBudget } from './room-budget.service.js'
import { RealtimePolicy } from './realtime-policy.service.js'

@Injectable()
export class BackendMetrics {
    constructor(
        private readonly telemetry: BackendTelemetry,
        private readonly policy: RealtimePolicy,
        private readonly budget: RoomBudget,
    ) {}
    snapshot() {
        return this.telemetry.snapshot(
            this.policy.activeConnections,
            this.budget.activeRooms,
        )
    }
}
