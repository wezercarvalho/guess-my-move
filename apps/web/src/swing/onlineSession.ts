import type { SwingInput, SwingWorld } from '@guess-my-move/swing'
import type { SwingOnlineBridge } from './multiplayerClient.js'

/** Networking policy by composition; no detector, camera, React or renderer ownership. */
export class OnlineSwingSession {
    private tick = -1
    private round = -1
    private snapshotAt = -Infinity
    private lastInputAt = -Infinity
    private look = { yaw: 0, pitch: 0 }
    constructor(private readonly bridge: SwingOnlineBridge) {}
    reset(): void {
        this.tick = -1
        this.round = -1
        this.snapshotAt = -Infinity
        this.lastInputAt = -Infinity
        this.look = { yaw: 0, pitch: 0 }
    }
    advance(
        world: Pick<SwingWorld, 'state' | 'advance'>,
        input: SwingInput,
        now: number,
        dt: number,
        onRound: () => void = () => {},
    ) {
        const view = this.bridge.getSnapshot()
        const room = view.room
        const playerId = view.access?.playerId ?? null
        const local = room?.players.find((player) => player.id === playerId)
        if (
            room &&
            local &&
            (room.tick !== this.tick || room.round !== this.round)
        ) {
            if (this.round >= 0 && room.round !== this.round) {
                this.reset()
                onRound()
            }
            Object.assign(world.state, structuredClone(local.state))
            this.snapshotAt = now
            this.tick = room.tick
            this.round = room.round
        }
        if (
            view.connection === 'connected' &&
            room?.status === 'playing' &&
            !view.stale
        ) {
            this.look.yaw += input.lookDelta?.yaw ?? 0
            this.look.pitch += input.lookDelta?.pitch ?? 0
            if (now - this.lastInputAt >= 100) {
                this.bridge.sendInput({
                    ...input,
                    lookDelta: {
                        yaw: Math.max(
                            -Math.PI,
                            Math.min(Math.PI, this.look.yaw),
                        ),
                        pitch: Math.max(
                            -Math.PI,
                            Math.min(Math.PI, this.look.pitch),
                        ),
                    },
                })
                this.look = { yaw: 0, pitch: 0 }
                this.lastInputAt = now
            }
            if (now - this.snapshotAt <= 100)
                world.advance(input, Math.min(dt, 0.1))
        } else this.look = { yaw: 0, pitch: 0 }
        return { room, playerId }
    }
}
