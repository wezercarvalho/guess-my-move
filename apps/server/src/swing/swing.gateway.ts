import { Inject, Logger, type OnApplicationShutdown } from '@nestjs/common'
import {
    ConnectedSocket,
    MessageBody,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
    type OnGatewayInit,
    type OnGatewayDisconnect,
} from '@nestjs/websockets'
import {
    SWING_CLIENT_EVENTS,
    SWING_SERVER_EVENTS,
    swingCreateSchema,
    swingJoinSchema,
    swingResumeSchema,
    swingRecoverSchema,
    swingReadySchema,
    swingCommandSchema,
    swingRematchSchema,
    swingLeaveSchema,
    type SwingAck,
} from '@guess-my-move/swing'
import { type Namespace, type Socket } from 'socket.io'
import { SlidingWindowRateLimiter } from '../realtime/rate-limit.js'
import { RealtimePolicy } from '../realtime/realtime-policy.service.js'
import { BackendTelemetry } from '../observability/backend-telemetry.service.js'
import { SwingRoomError, SwingRoomService } from './swing-room.service.js'
interface Schema<T> {
    safeParse(value: unknown): { success: true; data: T } | { success: false }
}
@WebSocketGateway({
    namespace: '/swing',
    transports: ['websocket'],
    maxHttpBufferSize: 8192,
    cors: false,
})
export class SwingGateway
    implements OnGatewayInit, OnGatewayDisconnect, OnApplicationShutdown
{
    @WebSocketServer() server!: Namespace
    private timer: NodeJS.Timeout | null = null
    private lastTick = 0
    private readonly limiter = new SlidingWindowRateLimiter({
        limit: 20,
        windowMs: 1000,
    })
    private readonly logger = new Logger('SwingGateway')
    constructor(
        @Inject(SwingRoomService) private readonly rooms: SwingRoomService,
        @Inject(RealtimePolicy) private readonly policy: RealtimePolicy,
        @Inject(BackendTelemetry) private readonly telemetry: BackendTelemetry,
    ) {}
    afterInit(): void {
        this.server.use((client, next) => {
            if (!this.policy.allowOrigin(client.handshake.headers.origin)) {
                this.telemetry.counters.rejectedOrigins++
                next(new Error('Origem não permitida.'))
                return
            }
            if (!this.policy.connect(client.id, this.policy.address(client))) {
                this.telemetry.counters.rejectedConnections++
                next(new Error('Capacidade de conexões atingida.'))
                return
            }
            this.telemetry.counters.acceptedConnections++
            next()
        })
        this.lastTick = Date.now()
        this.timer = setInterval(() => {
            const now = Date.now()
            this.telemetry.counters.maxTickDelayMs = Math.max(
                this.telemetry.counters.maxTickDelayMs,
                now - this.lastTick - 100,
            )
            this.rooms.advance(now - this.lastTick)
            this.lastTick = now
            const states = this.rooms.snapshots()
            for (const state of states)
                this.server
                    .to(state.roomCode)
                    .emit(SWING_SERVER_EVENTS.state, state)
            for (const code of this.rooms.drainExpired()) {
                this.telemetry.counters.expiredRooms++
                this.server.to(code).emit(SWING_SERVER_EVENTS.error, {
                    code: 'room-expired',
                    message: 'A sala expirou. Crie ou entre em outra sala.',
                })
                this.server.in(code).socketsLeave(code)
            }
        }, 100)
        this.timer.unref()
    }
    onApplicationShutdown(): void {
        if (this.timer) clearInterval(this.timer)
        this.timer = null
    }
    handleDisconnect(client: Socket): void {
        const code = this.rooms.roomCode(client.id)
        this.policy.disconnect(client.id)
        this.limiter.forget(client.id)
        this.rooms.disconnect(client.id)
        if (code) this.publish(code)
    }
    private publish(code: string): void {
        const state = this.rooms.snapshot(code)
        if (state) this.server.to(code).emit(SWING_SERVER_EVENTS.state, state)
    }
    private async command<T>(
        client: Socket,
        event: string,
        raw: unknown,
        schema: Schema<T>,
        action: (data: T) => SwingAck | Promise<SwingAck>,
    ): Promise<SwingAck> {
        const started = performance.now()
        let result: SwingAck
        try {
            if (!this.limiter.accept(client.id)) {
                this.telemetry.counters.rateLimited++
                throw new SwingRoomError(
                    'rate-limited',
                    'Muitos comandos. Aguarde um instante.',
                )
            }
            if (
                [
                    SWING_CLIENT_EVENTS.create,
                    SWING_CLIENT_EVENTS.join,
                    SWING_CLIENT_EVENTS.resume,
                ].includes(event as 'swing:create') &&
                !this.policy.acceptRoomAttempt(this.policy.address(client))
            ) {
                this.telemetry.counters.rateLimited++
                throw new SwingRoomError(
                    'rate-limited',
                    'Muitas tentativas de sala. Aguarde um instante.',
                )
            }
            const parsed = schema.safeParse(raw)
            if (!parsed.success) {
                this.telemetry.counters.invalidCommands++
                throw new SwingRoomError('invalid-command', 'Comando inválido.')
            }
            result = await action(parsed.data)
            const code = this.rooms.roomCode(client.id)
            if (code && event !== SWING_CLIENT_EVENTS.input) this.publish(code)
        } catch (error) {
            if (error instanceof SwingRoomError)
                result = {
                    ok: false,
                    error: { code: error.code, message: error.message },
                }
            else {
                this.telemetry.counters.internalErrors++
                this.logger.error(
                    'Falha interna ao processar comando cooperativo.',
                )
                result = {
                    ok: false,
                    error: {
                        code: 'internal-error',
                        message: 'Não foi possível processar o comando agora.',
                    },
                }
            }
        }
        this.telemetry.record(event, !result.ok, performance.now() - started)
        return result
    }
    @SubscribeMessage(SWING_CLIENT_EVENTS.create)
    create(
        @ConnectedSocket() client: Socket,
        @MessageBody() raw: unknown,
    ): Promise<SwingAck> {
        return this.command(
            client,
            SWING_CLIENT_EVENTS.create,
            raw,
            swingCreateSchema,
            async (data) => {
                const access = this.rooms.create(client.id, data)
                await client.join(access.roomCode)
                return { ok: true, access }
            },
        )
    }
    @SubscribeMessage(SWING_CLIENT_EVENTS.join)
    join(
        @ConnectedSocket() client: Socket,
        @MessageBody() raw: unknown,
    ): Promise<SwingAck> {
        return this.command(
            client,
            SWING_CLIENT_EVENTS.join,
            raw,
            swingJoinSchema,
            async (data) => {
                const access = this.rooms.join(client.id, data)
                await client.join(access.roomCode)
                return { ok: true, access }
            },
        )
    }
    @SubscribeMessage(SWING_CLIENT_EVENTS.resume)
    resume(
        @ConnectedSocket() client: Socket,
        @MessageBody() raw: unknown,
    ): Promise<SwingAck> {
        return this.command(
            client,
            SWING_CLIENT_EVENTS.resume,
            raw,
            swingResumeSchema,
            async (data) => {
                const access = this.rooms.resume(client.id, data)
                await client.join(access.roomCode)
                return { ok: true, access }
            },
        )
    }
    @SubscribeMessage(SWING_CLIENT_EVENTS.recover)
    recover(
        @ConnectedSocket() client: Socket,
        @MessageBody() raw: unknown,
    ): Promise<SwingAck> {
        return this.command(
            client,
            SWING_CLIENT_EVENTS.recover,
            raw,
            swingRecoverSchema,
            () => ({ ok: true, access: this.rooms.recover(client.id) }),
        )
    }
    @SubscribeMessage(SWING_CLIENT_EVENTS.ready)
    ready(
        @ConnectedSocket() client: Socket,
        @MessageBody() raw: unknown,
    ): Promise<SwingAck> {
        return this.command(
            client,
            SWING_CLIENT_EVENTS.ready,
            raw,
            swingReadySchema,
            (data) => {
                this.rooms.ready(client.id, data.ready)
                return { ok: true }
            },
        )
    }
    @SubscribeMessage(SWING_CLIENT_EVENTS.input)
    input(
        @ConnectedSocket() client: Socket,
        @MessageBody() raw: unknown,
    ): Promise<SwingAck> {
        return this.command(
            client,
            SWING_CLIENT_EVENTS.input,
            raw,
            swingCommandSchema,
            (data) => {
                this.rooms.input(client.id, data)
                return { ok: true }
            },
        )
    }
    @SubscribeMessage(SWING_CLIENT_EVENTS.rematch)
    rematch(
        @ConnectedSocket() client: Socket,
        @MessageBody() raw: unknown,
    ): Promise<SwingAck> {
        return this.command(
            client,
            SWING_CLIENT_EVENTS.rematch,
            raw,
            swingRematchSchema,
            (data) => {
                this.rooms.rematch(client.id, data.round)
                return { ok: true }
            },
        )
    }
    @SubscribeMessage(SWING_CLIENT_EVENTS.leave)
    leave(
        @ConnectedSocket() client: Socket,
        @MessageBody() raw: unknown,
    ): Promise<SwingAck> {
        return this.command(
            client,
            SWING_CLIENT_EVENTS.leave,
            raw,
            swingLeaveSchema,
            async () => {
                const code = this.rooms.roomCode(client.id)
                this.rooms.leave(client.id)
                if (code) {
                    await client.leave(code)
                    this.publish(code)
                }
                return { ok: true }
            },
        )
    }
}
