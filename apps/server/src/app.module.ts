import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

import { environmentSchema } from './config/environment.js'
import { GuessModule } from './guess/guess.module.js'
import { HealthController } from './health/health.controller.js'

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            validationSchema: environmentSchema,
        }),
        GuessModule,
    ],
    controllers: [HealthController],
})
export class AppModule {}
