import { CardsOriginGuard } from './cards-origin.guard.js'
import { HttpTimingInterceptor } from '../observability/http-timing.interceptor.js'
import type { IncomingMessage } from 'node:http'
import {
    Body,
    Controller,
    Header,
    Headers,
    HttpCode,
    HttpException,
    Inject,
    Param,
    Post,
    Req,
    SerializeOptions,
    StandardSchemaSerializerInterceptor,
    StandardSchemaValidationPipe,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common'
import {
    cardRoundAccessSchema,
    cardRoundSnapshotSchema,
    startCardRoundSchema,
    observeCardRoundSchema,
    cancelCardRoundSchema,
    type StartCardRound,
    type ObserveCardRound,
} from '@guess-my-move/core'
import { RealtimePolicy } from '../realtime/realtime-policy.service.js'
import { clientAddress } from '../realtime/admission.js'
import { SERVER_CONFIG, type ServerConfig } from '../server-config.js'
import { CardRoundsService } from './card-rounds.service.js'

const validation = new StandardSchemaValidationPipe({
    exceptionFactory: () => new HttpException('Comando inválido.', 400),
})

@UseGuards(CardsOriginGuard)
@UseInterceptors(HttpTimingInterceptor, StandardSchemaSerializerInterceptor)
@Controller('api/cards/rounds')
export class CardsController {
    constructor(
        private readonly rounds: CardRoundsService,
        private readonly policy: RealtimePolicy,
        @Inject(SERVER_CONFIG) private readonly config: ServerConfig,
    ) {}

    @Post()
    @Header('Cache-Control', 'no-store')
    @SerializeOptions({ schema: cardRoundAccessSchema })
    start(
        @Req() request: IncomingMessage,
        @Body({ schema: startCardRoundSchema, pipes: [validation] })
        command: StartCardRound,
    ) {
        const address = clientAddress(
            request.socket.remoteAddress ?? '',
            request.headers['x-forwarded-for'],
            this.config.trustedProxyIps,
        )
        if (!this.policy.acceptRoomAttempt(address))
            throw new HttpException('Limite de tentativas atingido.', 429)
        return this.rounds.start(command)
    }
    @Post(':id/observe')
    @HttpCode(200)
    @Header('Cache-Control', 'no-store')
    @SerializeOptions({ schema: cardRoundSnapshotSchema })
    observe(
        @Param('id') id: string,
        @Headers('authorization') authorization: string | undefined,
        @Body({ schema: observeCardRoundSchema, pipes: [validation] })
        command: ObserveCardRound,
    ) {
        return this.rounds.observe(id, this.token(authorization), command)
    }
    @Post(':id/cancel')
    @HttpCode(200)
    @Header('Cache-Control', 'no-store')
    @SerializeOptions({ schema: cardRoundSnapshotSchema })
    cancel(
        @Param('id') id: string,
        @Headers('authorization') authorization: string | undefined,
        @Body({ schema: cancelCardRoundSchema, pipes: [validation] })
        _command: Record<string, never>,
    ) {
        return this.rounds.cancel(id, this.token(authorization))
    }
    private token(value: string | undefined): string {
        return /^Bearer [A-Za-z0-9_-]{32,128}$/.test(value ?? '')
            ? value!.slice(7)
            : ''
    }
}
