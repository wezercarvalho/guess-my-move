import * as z from 'zod/mini'

/** Modos aceitos pelo protocolo. Deve acompanhar o registro público de modos. */
export const MODE_IDS = ['bete', 'triangle', 'hole'] as const
export type ModeId = (typeof MODE_IDS)[number]

export const CLIENT_EVENTS = {
    create: 'room:create',
    join: 'room:join',
    resume: 'room:resume',
    ready: 'room:ready',
    rematch: 'room:rematch',
    shot: 'match:shot',
    leave: 'room:leave',
} as const

export const SERVER_EVENTS = {
    state: 'room:state',
    error: 'protocol:error',
} as const

export const ROOM_CODE_LENGTH = 6
export const MIN_SHOT_SPEED = 150
export const MAX_SHOT_SPEED = 1100
export const RECONNECT_GRACE_MS = 60_000
export const MAX_SOCKET_PAYLOAD_BYTES = 8 * 1024
export const MAX_COMMANDS_PER_SECOND = 20

const strict = <T extends z.core.$ZodShape>(shape: T) => z.strictObject(shape)
const nonNegativeInt = () => z.int().check(z.nonnegative())
const positiveInt = () => z.int().check(z.positive())
const finiteNumber = () => z.number()

export const modeIdSchema = z.enum(MODE_IDS)
export const competitorSchema = z.enum(['player', 'opponent'])
export const roomCodeSchema = z.string().check(z.regex(/^[A-HJ-NP-Z2-9]{6}$/))
export const resumeTokenSchema = z
    .string()
    .check(z.regex(/^[A-Za-z0-9_-]{32,128}$/))

export function normalizeRoomCode(value: string): string {
    return value.replace(/\s+/g, '').toUpperCase()
}

export const nicknameSchema = z.pipe(
    z.string().check(z.regex(/^[\p{L}\p{M}\p{N} ._-]+$/u)),
    z.transform((value) => value.normalize('NFKC').trim().replace(/ +/g, ' ')),
).check(z.minLength(2), z.maxLength(20))

export const createRoomSchema = strict({ modeId: modeIdSchema, nickname: z.exactOptional(nicknameSchema) })
export const joinRoomSchema = strict({ roomCode: roomCodeSchema, nickname: z.exactOptional(nicknameSchema) })
export const resumeRoomSchema = strict({
    roomCode: roomCodeSchema,
    resumeToken: resumeTokenSchema,
})
export const readyRoomSchema = strict({ ready: z.boolean() })
export const leaveRoomSchema = strict({})
export const rematchRoomSchema = strict({ ready: z.boolean(), matchNumber: positiveInt() })

export const velocitySchema = strict({
    x: finiteNumber(),
    y: finiteNumber(),
}).check(
    z.refine(
        ({ x, y }) => {
            const speed = Math.hypot(x, y)
            return speed >= MIN_SHOT_SPEED && speed <= MAX_SHOT_SPEED
        },
        { error: `velocidade deve ficar entre ${MIN_SHOT_SPEED} e ${MAX_SHOT_SPEED}` },
    ),
)

export const shotCommandSchema = strict({
    matchNumber: z.exactOptional(positiveInt()),
    seq: positiveInt(),
    velocity: velocitySchema,
})

const vecSchema = strict({ x: finiteNumber(), y: finiteNumber() })
const bodySchema = strict({
    pos: vecSchema,
    vel: vecSchema,
    radius: z.number().check(z.positive()),
})
const outcomeSchema = z.enum(['win', 'draw', 'loss'])
const phaseSchema = z.enum([
    'choosing',
    'player-turn',
    'opponent-turn',
    'rolling',
    'round-over',
    'match-over',
])
const shotsByCompetitorSchema = strict({
    player: nonNegativeInt(),
    opponent: nonNegativeInt(),
})
const circleSchema = strict({
    x: finiteNumber(),
    y: finiteNumber(),
    radius: z.number().check(z.positive()),
})
const restingSchema = strict({
    pos: vecSchema,
    radius: z.number().check(z.positive()),
    owner: competitorSchema,
})
const decorSchema = strict({
    circle: z.exactOptional(circleSchema),
    holes: z.exactOptional(
        strict({
            positions: z.array(vecSchema),
            radius: z.number().check(z.positive()),
            active: nonNegativeInt(),
        }),
    ),
    resting: z.exactOptional(z.array(restingSchema)),
})

/** Snapshot serializável do fio; omite campos legados do snapshot interno. */
export const wireMatchSnapshotSchema = strict({
    modeId: modeIdSchema,
    opponent: z.literal('remote'),
    phase: phaseSchema,
    round: nonNegativeInt(),
    roundsPerMatch: positiveInt(),
    roundOutcomes: z.array(outcomeSchema),
    lastRoundOutcome: z.nullable(outcomeSchema),
    matchOutcome: z.nullable(outcomeSchema),
    turn: z.nullable(competitorSchema),
    shotsLeft: shotsByCompetitorSchema,
    roundYield: shotsByCompetitorSchema,
    scoreLabel: z.nullable(z.string()),
    field: z.array(bodySchema),
    decor: z.nullable(decorSchema),
})

const playerPresenceSchema = strict({
    connected: z.boolean(), ready: z.boolean(),
    nickname: z.exactOptional(z.nullable(nicknameSchema)),
    rematchReady: z.exactOptional(z.boolean()),
})
export const roomStatusSchema = z.enum(['waiting', 'ready', 'playing', 'paused', 'finished'])
export const roomIntentSchema = z.nullable(
    strict({ competitor: competitorSchema, velocity: velocitySchema }),
)

export const roomStateSchema = strict({
    roomCode: roomCodeSchema,
    modeId: modeIdSchema,
    status: roomStatusSchema,
    version: nonNegativeInt(),
    matchNumber: z.exactOptional(positiveInt()),
    nextTurn: z.exactOptional(z.nullable(competitorSchema)),
    players: strict({
        player: playerPresenceSchema,
        opponent: playerPresenceSchema,
    }),
    match: z.nullable(wireMatchSnapshotSchema),
    intent: roomIntentSchema,
    reconnectDeadlineMs: z.nullable(z.number().check(z.nonnegative())),
})

export const roomAccessSchema = strict({
    roomCode: roomCodeSchema,
    role: competitorSchema,
    resumeToken: resumeTokenSchema,
})

export const protocolErrorCodeSchema = z.enum([
    'INVALID_PAYLOAD',
    'NICKNAME_TAKEN',
    'STALE_MATCH',
    'RATE_LIMITED',
    'ROOM_LIMIT',
    'ROOM_NOT_FOUND',
    'ROOM_FULL',
    'ROOM_STARTED',
    'NOT_IN_ROOM',
    'NOT_READY',
    'NOT_YOUR_TURN',
    'DUPLICATE_COMMAND',
    'RESUME_DENIED',
    'INTERNAL_ERROR',
])
export const protocolErrorSchema = strict({
    code: protocolErrorCodeSchema,
    message: z.string(),
})

export type CreateRoomCommand = z.infer<typeof createRoomSchema>
export type JoinRoomCommand = z.infer<typeof joinRoomSchema>
export type ResumeRoomCommand = z.infer<typeof resumeRoomSchema>
export type RematchRoomCommand = z.infer<typeof rematchRoomSchema>
export type ReadyRoomCommand = z.infer<typeof readyRoomSchema>
export type ShotCommand = z.infer<typeof shotCommandSchema>
export type RoomState = z.infer<typeof roomStateSchema>
export type RoomAccess = z.infer<typeof roomAccessSchema>
export type ProtocolError = z.infer<typeof protocolErrorSchema>
export type ProtocolErrorCode = z.infer<typeof protocolErrorCodeSchema>
export type WireMatchSnapshot = z.infer<typeof wireMatchSnapshotSchema>
