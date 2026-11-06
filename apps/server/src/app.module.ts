import { Module } from '@nestjs/common'

import { HealthController } from './health/health.controller.js'
import { MultiplayerGateway } from './multiplayer/multiplayer.gateway.js'
import { RoomService } from './multiplayer/room.service.js'
import {
    SERVER_CONFIG,
    type ServerConfig,
    loadServerConfig,
} from './server-config.js'

@Module({
    controllers: [HealthController],
    providers: [
        {
            provide: SERVER_CONFIG,
            useFactory: (): ServerConfig => loadServerConfig(process.env),
        },
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
