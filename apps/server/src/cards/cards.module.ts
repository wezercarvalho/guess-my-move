import {
    Injectable,
    Module,
    type OnModuleInit,
    type OnApplicationShutdown,
} from '@nestjs/common'
import { CardsController } from './cards.controller.js'
import { CardsOriginGuard } from './cards-origin.guard.js'
import { CardRoundsService } from './card-rounds.service.js'
import { RealtimeModule } from '../realtime/realtime.module.js'
import { ObservabilityModule } from '../observability/observability.module.js'
import { HttpTimingInterceptor } from '../observability/http-timing.interceptor.js'

@Injectable()
class CardsExpiry implements OnModuleInit, OnApplicationShutdown {
    private ticker: NodeJS.Timeout | undefined
    constructor(private readonly rounds: CardRoundsService) {}
    onModuleInit(): void {
        this.ticker = setInterval(() => this.rounds.sweep(), 1000)
        this.ticker.unref()
    }
    onApplicationShutdown(): void {
        clearInterval(this.ticker)
        this.ticker = undefined
    }
}

@Module({
    imports: [RealtimeModule, ObservabilityModule],
    controllers: [CardsController],
    providers: [
        HttpTimingInterceptor,
        CardsOriginGuard,
        CardsExpiry,
        {
            provide: CardRoundsService,
            useFactory: () => new CardRoundsService(),
        },
    ],
    exports: [CardRoundsService],
})
export class CardsModule {}
