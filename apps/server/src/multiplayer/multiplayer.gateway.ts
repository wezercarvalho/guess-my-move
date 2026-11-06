import { randomUUID } from 'node:crypto'
import { Inject, Logger, type OnApplicationShutdown } from '@nestjs/common'
import {
    ConnectedSocket,
    MessageBody,
    OnGatewayDisconnect,
    OnGatewayInit,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets'
import {
    CLIENT_EVENTS,
    MAX_COMMANDS_PER_SECOND,
    MAX_SOCKET_PAYLOAD_BYTES,
    SERVER_EVENTS,
    type ProtocolError,
    type RoomAccess,
    createRoomSchema,
    joinRoomSchema,
    leaveRoomSchema,
    normalizeRoomCode,
    readyRoomSchema,
    rematchRoomSchema,
    resumeRoomSchema,
    shotCommandSchema,
} from '@guess-my-move/marbles'
import { type Server, type Socket } from 'socket.io'

import { SERVER_CONFIG, type ServerConfig } from '../server-config.js'
import {
    ConnectionAdmission,
    clientAddress,
    isAllowedOrigin,
} from './admission.js'
import { SlidingWindowRateLimiter } from './rate-limit.js'
import { RoomError, RoomService } from './room.service.js'

export type CommandAck =
    { ok: true; access?: RoomAccess } | { ok: false; error: ProtocolError }

interface Schema<T> {
    safeParse(value: unknown): { success: true; data: T } | { success: false }
}

@WebSocketGateway({
    transports: ['websocket'],
    maxHttpBufferSize: MAX_SOCKET_PAYLOAD_BYTES,
    cors: false,
})
export class MultiplayerGateway
    implements OnGatewayInit, OnGatewayDisconnect, OnApplicationShutdown
{
    @WebSocketServer()
    server!: Server

    private readonly limiter = new SlidingWindowRateLimiter({
        limit: MAX_COMMANDS_PER_SECOND,
        windowMs: 1000,
    })
    private ticker: NodeJS.Timeout | null = null
    private readonly logger = new Logger('MultiplayerGateway')
    private readonly admission: ConnectionAdmission
    private readonly counters = {
        acceptedConnections: 0,
        rejectedConnections: 0,
        rejectedOrigins: 0,
        rateLimited: 0,
        invalidCommands: 0,
        internalErrors: 0,
        expiredRooms: 0,
        maxTickDelayMs: 0,
    }
    private lastSummary = Date.now()
    private lastTick = Date.now()

    constructor(
        private readonly rooms: RoomService,
        @Inject(SERVER_CONFIG) private readonly config: ServerConfig,
    ) {
        this.admission = new ConnectionAdmission(config)
    }

    afterInit(): void {
        this.server.engine.opts.allowRequest = (request, callback) => {
            const allowed = isAllowedOrigin(request.headers.origin, this.config)
            if (!allowed) this.counters.rejectedOrigins++
            callback(null, allowed)
        }
        this.server.use((client, next) => {
            if (!this.admission.connect(client.id, this.address(client))) {
                this.counters.rejectedConnections++
                next(
                    new Error(
                        'Capacidade de conexões atingida. Tente novamente mais tarde.',
                    ),
                )
                return
            }
            this.counters.acceptedConnections++
            next()
        })
        this.ticker = setInterval(() => {
            const now = Date.now()
            this.counters.maxTickDelayMs = Math.max(
                this.counters.maxTickDelayMs,
                now - this.lastTick - this.config.tickMs,
            )
            this.lastTick = now
            const result = this.rooms.tick(this.config.tickMs)
            this.counters.expiredRooms += result.expired.length
            if (now - this.lastSummary >= 60_000) {
                this.logger.log(
                    JSON.stringify({
                        event: 'backend_summary',
                        ...this.metrics(),
                    }),
                )
                this.lastSummary = now
            }
            for (const state of result.updated)
                this.publish(state.roomCode, state)
            for (const roomCode of result.expired) {
                const error: ProtocolError = {
                    code: 'ROOM_NOT_FOUND',
                    message:
                        'A sala expirou por inatividade ou fim do prazo de reconexão.',
                }
                this.server.in(roomCode).emit(SERVER_EVENTS.error, error)
                this.server.in(roomCode).socketsLeave(roomCode)
            }
        }, this.config.tickMs)
        this.ticker.unref()
    }

    onApplicationShutdown(): void {
        if (this.ticker) clearInterval(this.ticker)
        this.ticker = null
    }

    handleDisconnect(client: Socket): void {
        this.admission.disconnect(client.id)
        this.limiter.forget(client.id)
        const state = this.rooms.disconnect(client.id)
        if (state) this.publish(state.roomCode, state)
    }

    @SubscribeMessage(CLIENT_EVENTS.create)
    async handleCreate(
        @ConnectedSocket() client: Socket,
        @MessageBody() raw: unknown,
    ): Promise<CommandAck> {
        return this.execute(
            client,
            CLIENT_EVENTS.create,
            createRoomSchema,
            raw,
            async (command) => {
                const result = this.rooms.create(client.id, command)
                await client.join(result.access.roomCode)
                this.publish(result.access.roomCode, result.state)
                return { ok: true, access: result.access }
            },
        )
    }

    @SubscribeMessage(CLIENT_EVENTS.join)
    async handleJoin(
        @ConnectedSocket() client: Socket,
        @MessageBody() raw: unknown,
    ): Promise<CommandAck> {
        const normalized = this.normalizeCode(raw)
        return this.execute(
            client,
            CLIENT_EVENTS.join,
            joinRoomSchema,
            normalized,
            async (command) => {
                const result = this.rooms.join(client.id, command)
                await client.join(result.access.roomCode)
                this.publish(result.access.roomCode, result.state)
                return { ok: true, access: result.access }
            },
        )
    }

    @SubscribeMessage(CLIENT_EVENTS.resume)
    async handleResume(
        @ConnectedSocket() client: Socket,
        @MessageBody() raw: unknown,
    ): Promise<CommandAck> {
        const normalized = this.normalizeCode(raw)
        return this.execute(
            client,
            CLIENT_EVENTS.resume,
            resumeRoomSchema,
            normalized,
            async (command) => {
                const result = this.rooms.resume(client.id, command)
                await client.join(result.access.roomCode)
                this.publish(result.access.roomCode, result.state)
                return { ok: true, access: result.access }
            },
        )
    }

    @SubscribeMessage(CLIENT_EVENTS.ready)
    async handleReady(
        @ConnectedSocket() client: Socket,
        @MessageBody() raw: unknown,
    ): Promise<CommandAck> {
        return this.execute(
            client,
            CLIENT_EVENTS.ready,
            readyRoomSchema,
            raw,
            (command) => {
                const state = this.rooms.setReady(client.id, command)
                this.publish(state.roomCode, state)
                return { ok: true }
            },
        )
    }

    @SubscribeMessage(CLIENT_EVENTS.rematch)
    async handleRematch(
        @ConnectedSocket() client: Socket,
        @MessageBody() raw: unknown,
    ): Promise<CommandAck> {
        return this.execute(
            client,
            CLIENT_EVENTS.rematch,
            rematchRoomSchema,
            raw,
            (command) => {
                const state = this.rooms.setRematchReady(client.id, command)
                this.publish(state.roomCode, state)
                return { ok: true }
            },
        )
    }

    @SubscribeMessage(CLIENT_EVENTS.shot)
    async handleShot(
        @ConnectedSocket() client: Socket,
        @MessageBody() raw: unknown,
    ): Promise<CommandAck> {
        return this.execute(
            client,
            CLIENT_EVENTS.shot,
            shotCommandSchema,
            raw,
            (command) => {
                const state = this.rooms.submitShot(client.id, command)
                this.publish(state.roomCode, state)
                return { ok: true }
            },
        )
    }

    @SubscribeMessage(CLIENT_EVENTS.leave)
    async handleLeave(
        @ConnectedSocket() client: Socket,
        @MessageBody() raw: unknown,
    ): Promise<CommandAck> {
        return this.execute(
            client,
            CLIENT_EVENTS.leave,
            leaveRoomSchema,
            raw,
            async () => {
                const membership = this.rooms.membershipForSocket(client.id)
                const roomCode = this.rooms.leave(client.id)
                if (roomCode && membership) {
                    const error: ProtocolError = {
                        code: 'ROOM_NOT_FOUND',
                        message: 'A sala foi encerrada.',
                    }
                    this.server.in(roomCode).emit(SERVER_EVENTS.error, error)
                    this.server.in(roomCode).socketsLeave(roomCode)
                    await client.leave(roomCode)
                }
                return { ok: true }
            },
        )
    }

    private async execute<T>(
        client: Socket,
        operation: string,
        schema: Schema<T>,
        raw: unknown,
        action: (command: T) => CommandAck | Promise<CommandAck>,
    ): Promise<CommandAck> {
        const roomOperation =
            operation === CLIENT_EVENTS.create ||
            operation === CLIENT_EVENTS.join ||
            operation === CLIENT_EVENTS.resume
        if (
            !this.limiter.accept(client.id) ||
            (roomOperation &&
                !this.admission.acceptRoomAttempt(this.address(client)))
        ) {
            this.counters.rateLimited++
            return this.fail(client, {
                code: 'RATE_LIMITED',
                message: 'Muitos comandos. Aguarde um instante.',
            })
        }
        const parsed = schema.safeParse(raw)
        if (!parsed.success) {
            this.counters.invalidCommands++
            return this.fail(client, {
                code: 'INVALID_PAYLOAD',
                message: 'Comando inválido.',
            })
        }
        try {
            return await action(parsed.data)
        } catch (error) {
            if (error instanceof RoomError) {
                return this.fail(client, {
                    code: error.code,
                    message: error.message,
                })
            }
            this.counters.internalErrors++
            this.logger.error(
                JSON.stringify({
                    event: 'multiplayer_internal_error',
                    operation,
                    correlationId: randomUUID(),
                }),
            )
            return this.fail(client, {
                code: 'INTERNAL_ERROR',
                message: 'Não foi possível processar o comando.',
            })
        }
    }

    metrics(): Readonly<typeof this.counters> & {
        activeConnections: number
        activeRooms: number
    } {
        return {
            ...this.counters,
            activeConnections: this.admission.activeConnections,
            activeRooms: this.rooms.activeRooms,
        }
    }

    private address(client: Socket): string {
        return clientAddress(
            client.handshake?.address ?? 'unknown',
            client.handshake?.headers['x-forwarded-for'],
            this.config.trustedProxyIps,
        )
    }

    private fail(client: Socket, error: ProtocolError): CommandAck {
        client.emit(SERVER_EVENTS.error, error)
        return { ok: false, error }
    }

    private publish(roomCode: string, state: unknown): void {
        this.server.to(roomCode).emit(SERVER_EVENTS.state, state)
    }

    private normalizeCode(raw: unknown): unknown {
        if (!raw || typeof raw !== 'object' || !('roomCode' in raw)) return raw
        const roomCode = Reflect.get(raw, 'roomCode')
        if (typeof roomCode !== 'string') return raw
        return { ...raw, roomCode: normalizeRoomCode(roomCode) }
    }
}
