import { z } from 'zod'
import { type City, type CityBuilding } from './city.js'
import { type SwingState } from './physics.js'
import { type Vec3 } from './vec.js'
import { type SwingInput } from './world.js'

export const SWING_CLIENT_EVENTS = {
    create: 'swing:create',
    join: 'swing:join',
    resume: 'swing:resume',
    recover: 'swing:recover',
    ready: 'swing:ready',
    input: 'swing:input',
    rematch: 'swing:rematch',
    leave: 'swing:leave',
} as const
export const SWING_SERVER_EVENTS = {
    state: 'swing:state',
    error: 'swing:error',
} as const
export interface SwingAccess {
    roomCode: string
    playerId: string
    resumeToken: string
}
export type SwingAck =
    | { ok: true; access?: SwingAccess }
    | { ok: false; error: { code: string; message: string } }
export interface SwingRoomState {
    roomCode: string
    cityId: string
    cityVersion: 1
    round: number
    tick: number
    status: 'waiting' | 'playing' | 'paused' | 'finished'
    players: Array<{
        id: string
        nickname: string
        connected: boolean
        ready: boolean
        rematchReady: boolean
        state: SwingState
    }>
    objectives: Array<{
        id: string
        position: Vec3
        collectedBy: string | null
    }>
}
const flags = z
    .object({
        left: z.boolean().optional(),
        center: z.boolean().optional(),
        right: z.boolean().optional(),
    })
    .strict()
const angle = z
    .object({
        yaw: z.number().finite().min(-Math.PI).max(Math.PI),
        pitch: z.number().finite().min(-Math.PI).max(Math.PI),
    })
    .strict()
export const swingInputSchema = z
    .object({
        held: flags,
        pull: flags.optional(),
        grab: flags.optional(),
        climb: z.number().finite().min(-1).max(1).optional(),
        releaseFist: z.boolean().optional(),
        yawRate: z.number().finite().min(-1).max(1),
        pitchRate: z.number().finite().min(-1).max(1),
        lookDelta: angle.optional(),
        lookActive: z.boolean().optional(),
        lookBias: angle.optional(),
    })
    .strict()
const nickname = z
    .string()
    .trim()
    .min(2)
    .max(20)
    .regex(/^[\p{L}\p{N} _.-]+$/u)
const roomCode = z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{6}$/)
export const swingCreateSchema = z
    .object({
        cityId: z.enum(['aurora', 'midtown', 'paulista', 'santa-maria']),
        nickname,
    })
    .strict()
export const swingJoinSchema = z.object({ roomCode, nickname }).strict()
export const swingResumeSchema = z
    .object({ roomCode, resumeToken: z.string().min(32).max(128) })
    .strict()
export const swingReadySchema = z.object({ ready: z.boolean() }).strict()
export const swingCommandSchema = z
    .object({
        round: z.number().int().positive(),
        seq: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
        input: swingInputSchema,
    })
    .strict()
export const swingRematchSchema = z
    .object({ round: z.number().int().positive() })
    .strict()
export const swingLeaveSchema = z.object({}).strict()
export const swingRecoverSchema = z.object({}).strict()
export type SwingCommand = z.infer<typeof swingCommandSchema>
export const NEUTRAL_SWING_INPUT: SwingInput = {
    held: {},
    yawRate: 0,
    pitchRate: 0,
}

/** Shared deterministic Aurora geometry, used by browser and authoritative server. */
export function createOnlineTrainingCity(): City {
    const buildings: CityBuilding[] = [
        { height: 150, ring: [-26, -166, 26, -166, 26, -114, -26, -114] },
    ]
    for (let row = -3; row <= 3; row++) {
        for (let col = -3; col <= 3; col++) {
            if (col === 0 || (Math.abs(col) === 1 && row >= -1 && row <= 1))
                continue
            const x = col * 90,
                z = row * 90
            const half = 22 + ((col * col + row * row) % 3) * 4
            const height = 120 + ((col * col + row * row * 3) % 7) * 22
            buildings.push({
                height,
                ring: [
                    x - half,
                    z - half,
                    x + half,
                    z - half,
                    x + half,
                    z + half,
                    x - half,
                    z + half,
                ],
            })
        }
    }
    for (const z of [-180, 180]) {
        buildings.push({
            height: 72,
            ring: [-248, z - 7, -112, z - 7, -112, z + 7, -248, z + 7],
        })
        buildings.push({
            height: 96,
            ring: [112, z - 7, 248, z - 7, 248, z + 7, 112, z + 7],
        })
    }
    return {
        version: 1,
        name: 'Aurora',
        attribution: 'Aurora · cenário procedural local do Guess My Move',
        bounds: { minX: -420, maxX: 420, minZ: -420, maxZ: 420 },
        buildings,
        roads: [],
        visual: { theme: 'aurora' },
    }
}
const vector = z
    .object({
        x: z.number().finite(),
        y: z.number().finite(),
        z: z.number().finite(),
    })
    .strict()
const stateSchema = z
    .object({
        position: vector,
        velocity: vector,
        yaw: z.number().finite(),
        pitch: z.number().finite(),
        webs: z
            .array(
                z
                    .object({
                        anchor: vector,
                        length: z.number().finite(),
                        side: z.union([
                            z.literal(-1),
                            z.literal(0),
                            z.literal(1),
                        ]),
                        pulling: z.boolean().optional(),
                        virtual: z.boolean().optional(),
                    })
                    .strict(),
            )
            .max(3),
        grounded: z.boolean(),
        grip: z
            .object({
                normal: vector,
                wallTop: z.number().finite(),
                graceMs: z.number().finite(),
                fistMs: z.number().finite(),
            })
            .strict()
            .nullable(),
        touchingWall: z.boolean(),
        started: z.boolean(),
        stats: z
            .object({
                distance: z.number().finite(),
                webs: z.number().int(),
                misses: z.number().int(),
                topSpeed: z.number().finite(),
            })
            .strict(),
    })
    .strict()
    .transform((state): SwingState => ({
        ...state,
        webs: state.webs.map((web) => ({
            anchor: web.anchor,
            length: web.length,
            side: web.side,
            ...(web.pulling === undefined ? {} : { pulling: web.pulling }),
            ...(web.virtual === undefined ? {} : { virtual: web.virtual }),
        })),
    }))
export const swingRoomStateSchema = z
    .object({
        roomCode,
        cityId: z.string(),
        cityVersion: z.literal(1),
        round: z.number().int().positive(),
        tick: z.number().int().nonnegative(),
        status: z.enum(['waiting', 'playing', 'paused', 'finished']),
        players: z
            .array(
                z
                    .object({
                        id: z.string(),
                        nickname,
                        connected: z.boolean(),
                        ready: z.boolean(),
                        rematchReady: z.boolean(),
                        state: stateSchema,
                    })
                    .strict(),
            )
            .max(2),
        objectives: z
            .array(
                z
                    .object({
                        id: z.string(),
                        position: vector,
                        collectedBy: z.string().nullable(),
                    })
                    .strict(),
            )
            .max(10),
    })
    .strict()
export const swingAccessSchema = z
    .object({
        roomCode,
        playerId: z.string(),
        resumeToken: z.string().min(32).max(128),
    })
    .strict()
export const swingAckSchema = z
    .union([
        z
            .object({
                ok: z.literal(true),
                access: swingAccessSchema.optional(),
            })
            .strict(),
        z
            .object({
                ok: z.literal(false),
                error: z
                    .object({ code: z.string(), message: z.string() })
                    .strict(),
            })
            .strict(),
    ])
    .transform((ack): SwingAck =>
        ack.ok
            ? ack.access
                ? { ok: true, access: ack.access }
                : { ok: true }
            : ack,
    )
