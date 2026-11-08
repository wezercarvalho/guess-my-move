import { Module } from '@nestjs/common'
import { RuntimeConfigModule } from '../runtime-config.module.js'
import { SERVER_CONFIG, type ServerConfig } from '../server-config.js'
import { BackendTelemetry } from './backend-telemetry.service.js'
import { ObserveModule, observeOptions } from './observe.setup.js'

@Module({
    imports: [
        RuntimeConfigModule,
        ObserveModule.forRootAsync({
            imports: [RuntimeConfigModule],
            inject: [SERVER_CONFIG],
            useFactory: (config: ServerConfig) => observeOptions(config),
        }),
    ],
    providers: [BackendTelemetry],
    exports: [BackendTelemetry],
})
export class ObservabilityModule {}
