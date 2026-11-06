import { Module } from '@nestjs/common'
import { RuntimeConfigModule } from '../runtime-config.module.js'
import { ObservabilityModule } from '../observability/observability.module.js'
import { RealtimeModule } from '../realtime/realtime.module.js'
import { RoomBudget } from '../realtime/room-budget.service.js'
import { SERVER_CONFIG, type ServerConfig } from '../server-config.js'
import { RoomService } from './room.service.js'
import { MultiplayerGateway } from './multiplayer.gateway.js'

@Module({
    imports: [RuntimeConfigModule, ObservabilityModule, RealtimeModule],
    providers: [
        {
            provide: RoomService,
            inject: [SERVER_CONFIG, RoomBudget],
            useFactory: (config: ServerConfig, budget: RoomBudget) => {
                const rooms = new RoomService({
                    maxRooms: config.maxRooms,
                    canCreateRoom: () => budget.canCreate(config.maxRooms),
                    waitingTimeoutMs: config.waitingTimeoutMs,
                    idleTimeoutMs: config.idleTimeoutMs,
                    finishedTimeoutMs: config.finishedTimeoutMs,
                })
                budget.register('marbles', () => rooms.activeRooms)
                return rooms
            },
        },
        MultiplayerGateway,
    ],
    exports: [RoomService],
})
export class MarblesMultiplayerModule {}
