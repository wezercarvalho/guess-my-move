import { Inject, type OnApplicationShutdown } from '@nestjs/common'
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
    resumeRoomSchema,
    shotCommandSchema,
} from '@guess-my-move/marbles'
import { type Server, type Socket } from 'socket.io'

import { SERVER_CONFIG, type ServerConfig } from '../server-config.js'
import { SlidingWindowRateLimiter } from './rate-limit.js'
import { RoomError, RoomService } from './room.service.js'

export type CommandAck =
    | { ok: true; access?: RoomAccess }
    | { ok: false; error: ProtocolError }

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

    constructor(
        private readonly rooms: RoomService,
        @Inject(SERVER_CONFIG) private readonly config: Pick<ServerConfig, 'tickMs'>,
    ) {}

    afterInit(): void {
        this.ticker = setInterval(() => {
            const result = this.rooms.tick(this.config.tickMs)
            for (const state of result.updated) this.publish(state.roomCode, state)
            for (const roomCode of result.expired) {
                const error: ProtocolError = {
                    code: 'ROOM_NOT_FOUND',
                    message: 'A sala expirou após a desconexão.',
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
        this.limiter.forget(client.id)
        const state = this.rooms.disconnect(client.id)
        if (state) this.publish(state.roomCode, state)
    }

    @SubscribeMessage(CLIENT_EVENTS.create)
    async handleCreate(
        @ConnectedSocket() client: Socket,
        @MessageBody() raw: unknown,
    ): Promise<CommandAck> {
        return this.execute(client, createRoomSchema, raw, async (command) => {
            const result = this.rooms.create(client.id, command)
            await client.join(result.access.roomCode)
            this.publish(result.access.roomCode, result.state)
            return { ok: true, access: result.access }
        })
    }

    @SubscribeMessage(CLIENT_EVENTS.join)
    async handleJoin(
        @ConnectedSocket() client: Socket,
        @MessageBody() raw: unknown,
    ): Promise<CommandAck> {
        const normalized = this.normalizeCode(raw)
        return this.execute(client, joinRoomSchema, normalized, async (command) => {
            const result = this.rooms.join(client.id, command)
            await client.join(result.access.roomCode)
            this.publish(result.access.roomCode, result.state)
            return { ok: true, access: result.access }
        })
    }

    @SubscribeMessage(CLIENT_EVENTS.resume)
    async handleResume(
        @ConnectedSocket() client: Socket,
        @MessageBody() raw: unknown,
    ): Promise<CommandAck> {
        const normalized = this.normalizeCode(raw)
        return this.execute(client, resumeRoomSchema, normalized, async (command) => {
            const result = this.rooms.resume(client.id, command)
            await client.join(result.access.roomCode)
            this.publish(result.access.roomCode, result.state)
            return { ok: true, access: result.access }
        })
    }

    @SubscribeMessage(CLIENT_EVENTS.ready)
    async handleReady(
        @ConnectedSocket() client: Socket,
        @MessageBody() raw: unknown,
    ): Promise<CommandAck> {
        return this.execute(client, readyRoomSchema, raw, (command) => {
            const state = this.rooms.setReady(client.id, command)
            this.publish(state.roomCode, state)
            return { ok: true }
        })
    }

    @SubscribeMessage(CLIENT_EVENTS.shot)
    async handleShot(
        @ConnectedSocket() client: Socket,
        @MessageBody() raw: unknown,
    ): Promise<CommandAck> {
        return this.execute(client, shotCommandSchema, raw, (command) => {
            const state = this.rooms.submitShot(client.id, command)
            this.publish(state.roomCode, state)
            return { ok: true }
        })
    }

    @SubscribeMessage(CLIENT_EVENTS.leave)
    async handleLeave(
        @ConnectedSocket() client: Socket,
        @MessageBody() raw: unknown,
    ): Promise<CommandAck> {
        return this.execute(client, leaveRoomSchema, raw, async () => {
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
        })
    }

    private async execute<T>(
        client: Socket,
        schema: Schema<T>,
        raw: unknown,
        action: (command: T) => CommandAck | Promise<CommandAck>,
    ): Promise<CommandAck> {
        if (!this.limiter.accept(client.id)) {
            return this.fail(client, {
                code: 'RATE_LIMITED',
                message: 'Muitos comandos. Aguarde um instante.',
            })
        }
        const parsed = schema.safeParse(raw)
        if (!parsed.success) {
            return this.fail(client, { code: 'INVALID_PAYLOAD', message: 'Comando inválido.' })
        }
        try {
            return await action(parsed.data)
        } catch (error) {
            if (error instanceof RoomError) {
                return this.fail(client, { code: error.code, message: error.message })
            }
            return this.fail(client, {
                code: 'INTERNAL_ERROR',
                message: 'Não foi possível processar o comando.',
            })
        }
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
