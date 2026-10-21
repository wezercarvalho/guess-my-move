import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

import { validateEnv } from './config/environment.js'
import { HealthController } from './health/health.controller.js'

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            validate: validateEnv,
        }),
    ],
    controllers: [HealthController],
})
export class AppModule {}
