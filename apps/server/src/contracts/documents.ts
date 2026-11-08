import { cardsOpenApiPaths } from '../cards/cards.openapi.js'
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
    swingRoomStateSchema,
    swingAckSchema,
} from '@guess-my-move/swing'
import { z } from 'zod'
import {
    MIN_SHOT_SPEED,
    MAX_SHOT_SPEED,
    MAX_SOCKET_PAYLOAD_BYTES,
    MAX_COMMANDS_PER_SECOND,
    CLIENT_EVENTS,
    SERVER_EVENTS,
    createRoomSchema,
    joinRoomSchema,
    resumeRoomSchema,
    readyRoomSchema,
    leaveRoomSchema,
    rematchRoomSchema,
    shotCommandSchema,
    roomStateSchema,
    roomAccessSchema,
    protocolErrorSchema,
} from '@guess-my-move/marbles'
import { httpDefinitions } from './http-definitions.js'

const jsonSchema = (schema: z.core.$ZodType) =>
    z.toJSONSchema(schema, { io: 'input' })
const errorResponse = {
    description: 'Erro HTTP sem dados privados',
    content: {
        'application/json': {
            schema: {
                type: 'object',
                properties: {
                    statusCode: { type: 'integer' },
                    message: { type: 'string' },
                    error: { type: 'string' },
                },
                required: ['statusCode', 'message'],
            },
        },
    },
}

export function buildOpenApiDocument() {
    const paths = Object.fromEntries(
        httpDefinitions.map((route) => [
            route.path,
            {
                get: {
                    operationId: route.operationId,
                    summary: route.summary,
                    security: route.protected ? [{ metricsToken: [] }] : [],
                    responses: {
                        '200': {
                            description: 'Resposta válida',
                            content: {
                                'application/json': {
                                    schema: jsonSchema(route.schema),
                                },
                            },
                        },
                        ...(route.protected
                            ? {
                                  '401': errorResponse,
                                  '404': {
                                      ...errorResponse,
                                      description: 'Métricas não habilitadas',
                                  },
                              }
                            : {}),
                        '500': errorResponse,
                    },
                },
            },
        ]),
    )
    return {
        openapi: '3.1.0',
        info: {
            title: 'Guess My Move HTTP API',
            version: '1.0.0',
            description:
                'HTTP de suporte ao jogo. Comandos de sala e tiros usam Socket.IO e possuem contrato separado.',
        },
        servers: [{ url: '/' }],
        paths: { ...paths, ...cardsOpenApiPaths() },
        components: {
            securitySchemes: {
                cardRoundToken: { type: 'http', scheme: 'bearer', description: 'Token privado e efêmero da rodada; nunca guardar em URL, storage persistente ou logs.' },
                metricsToken: {
                    type: 'http',
                    scheme: 'bearer',
                    description:
                        'Token exclusivo de operação; não é uma credencial de jogador.',
                },
            },
        },
    }
}

export function buildMultiplayerContract() {
    const clientEvents = {
        [CLIENT_EVENTS.create]: jsonSchema(createRoomSchema),
        [CLIENT_EVENTS.join]: jsonSchema(joinRoomSchema),
        [CLIENT_EVENTS.resume]: jsonSchema(resumeRoomSchema),
        [CLIENT_EVENTS.ready]: jsonSchema(readyRoomSchema),
        [CLIENT_EVENTS.rematch]: jsonSchema(rematchRoomSchema),
        [CLIENT_EVENTS.shot]: jsonSchema(shotCommandSchema),
        [CLIENT_EVENTS.leave]: jsonSchema(leaveRoomSchema),
    }
    const ack = z.union([
        z.strictObject({
            ok: z.literal(true),
            access: z.optional(roomAccessSchema),
        }),
        z.strictObject({ ok: z.literal(false), error: protocolErrorSchema }),
    ])
    return {
        protocolVersion: 1,
        transport: 'socket.io',
        socketIoMajor: 4,
        path: '/socket.io',
        namespace: '/',
        description:
            'Usar cliente Socket.IO com transporte websocket, não WebSocket puro. access é privado no acknowledgement; nunca retransmitir resumeToken.',
        normalization:
            'Apelidos usam NFKC, trim e espaços colapsados; 2–20 caracteres após normalização. Códigos de sala aceitam normalização de espaços e caixa na entrada.',
        constraints: {
            shotSpeed: {
                metric: 'hypot(x,y)',
                minimum: MIN_SHOT_SPEED,
                maximum: MAX_SHOT_SPEED,
            },
            maxSocketPayloadBytes: MAX_SOCKET_PAYLOAD_BYTES,
            maxCommandsPerSecond: MAX_COMMANDS_PER_SECOND,
            nicknameLengthAfterNormalization: { minimum: 2, maximum: 20 },
        },
        clientEvents,
        acknowledgement: jsonSchema(ack),
        serverEvents: {
            [SERVER_EVENTS.state]: jsonSchema(roomStateSchema),
            [SERVER_EVENTS.error]: jsonSchema(protocolErrorSchema),
        },
    }
}

export function buildSwingContract() {
    return {
        protocolVersion: 1,
        transport: 'socket.io',
        socketIoMajor: 4,
        namespace: '/swing',
        path: '/socket.io',
        description:
            'Cooperação para duas pessoas. Somente inputs derivados de gestos/teclado; posições, objetivos e resultados são autoritativos no servidor. Nunca enviar mídia ou landmarks. Credencial de retomada é privada no ACK e permanece em memória do próprio cliente.',
        constraints: {
            maxPlayers: 2,
            reconnectGraceMs: 60_000,
            inputsPerSecond: 10,
            commandLimitPerSecond: 20,
            snapshotsPerSecond: 10,
            maxSocketPayloadBytes: MAX_SOCKET_PAYLOAD_BYTES,
            inputTimeoutMs: 350,
        },
        clientEvents: {
            [SWING_CLIENT_EVENTS.create]: jsonSchema(swingCreateSchema),
            [SWING_CLIENT_EVENTS.join]: jsonSchema(swingJoinSchema),
            [SWING_CLIENT_EVENTS.resume]: jsonSchema(swingResumeSchema),
            [SWING_CLIENT_EVENTS.recover]: jsonSchema(swingRecoverSchema),
            [SWING_CLIENT_EVENTS.ready]: jsonSchema(swingReadySchema),
            [SWING_CLIENT_EVENTS.input]: jsonSchema(swingCommandSchema),
            [SWING_CLIENT_EVENTS.rematch]: jsonSchema(swingRematchSchema),
            [SWING_CLIENT_EVENTS.leave]: jsonSchema(swingLeaveSchema),
        },
        acknowledgement: jsonSchema(swingAckSchema),
        serverEvents: {
            [SWING_SERVER_EVENTS.state]: jsonSchema(swingRoomStateSchema),
            [SWING_SERVER_EVENTS.error]: {
                type: 'object',
                properties: {
                    code: { type: 'string' },
                    message: { type: 'string' },
                },
                required: ['code', 'message'],
                additionalProperties: false,
            },
        },
    }
}
