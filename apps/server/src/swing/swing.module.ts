import { Module } from '@nestjs/common'
import { RuntimeConfigModule } from '../runtime-config.module.js'
import { SERVER_CONFIG, type ServerConfig } from '../server-config.js'
import { RealtimeModule } from '../realtime/realtime.module.js'
import { ObservabilityModule } from '../observability/observability.module.js'
import { RoomBudget } from '../realtime/room-budget.service.js'
import { SwingGateway } from './swing.gateway.js'
import { SwingRoomService } from './swing-room.service.js'
@Module({
    imports: [RuntimeConfigModule, RealtimeModule, ObservabilityModule],
    providers: [
        {
            provide: SwingRoomService,
            inject: [SERVER_CONFIG, RoomBudget],
            useFactory: (config: ServerConfig, budget: RoomBudget) => {
                const rooms = new SwingRoomService({
                    maxRooms: config.maxRooms,
                    canCreateRoom: () => budget.canCreate(config.maxRooms),
                    waitingTimeoutMs: config.waitingTimeoutMs,
                    idleTimeoutMs: config.idleTimeoutMs,
                    finishedTimeoutMs: config.finishedTimeoutMs,
                })
                budget.register('swing', () => rooms.activeRooms)
                return rooms
            },
        },
        SwingGateway,
    ],
    exports: [SwingRoomService],
})
export class SwingMultiplayerModule {}
