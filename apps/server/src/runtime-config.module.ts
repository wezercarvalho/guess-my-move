import { Global, Module } from '@nestjs/common'
import { loadServerConfig, SERVER_CONFIG } from './server-config.js'

@Global()
@Module({
    providers: [
        {
            provide: SERVER_CONFIG,
            useFactory: () => loadServerConfig(process.env),
        },
    ],
    exports: [SERVER_CONFIG],
})
export class RuntimeConfigModule {}
