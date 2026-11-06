import type {
    Competitor,
    MatchSnapshot,
    ModeId,
    RoomState,
    WireMatchSnapshot,
} from '@guess-my-move/marbles'

interface PublicSlotSource {
    socketId: string | null
    ready: boolean
    nickname: string | null
    rematchReady: boolean
}
/** Explicit public fields; no session methods, clock, tokens or transport effects. */
export function projectPlayers(
    slots: Readonly<Record<Competitor, PublicSlotSource>>,
): RoomState['players'] {
    const project = (slot: PublicSlotSource) => ({
        connected: slot.socketId !== null,
        ready: slot.ready,
        nickname: slot.nickname,
        rematchReady: slot.rematchReady,
    })
    return { player: project(slots.player), opponent: project(slots.opponent) }
}
export function projectMatch(
    modeId: ModeId,
    snapshot: MatchSnapshot,
): WireMatchSnapshot {
    return {
        modeId,
        opponent: 'remote',
        phase: snapshot.phase,
        round: snapshot.round,
        roundsPerMatch: snapshot.roundsPerMatch,
        roundOutcomes: [...snapshot.roundOutcomes],
        lastRoundOutcome: snapshot.lastRoundOutcome,
        matchOutcome: snapshot.matchOutcome,
        turn: snapshot.turn,
        shotsLeft: { ...snapshot.shotsLeft },
        roundYield: { ...snapshot.roundYield },
        scoreLabel: snapshot.scoreLabel,
        field: snapshot.field.map((body) => ({
            pos: { ...body.pos },
            vel: { ...body.vel },
            radius: body.radius,
        })),
        decor: snapshot.decor
            ? {
                  ...(snapshot.decor.circle
                      ? { circle: { ...snapshot.decor.circle } }
                      : {}),
                  ...(snapshot.decor.holes
                      ? {
                            holes: {
                                positions: snapshot.decor.holes.positions.map(
                                    (point) => ({
                                        ...point,
                                    }),
                                ),
                                radius: snapshot.decor.holes.radius,
                                active: snapshot.decor.holes.active,
                            },
                        }
                      : {}),
                  ...(snapshot.decor.resting
                      ? {
                            resting: snapshot.decor.resting.map((rest) => ({
                                pos: { ...rest.pos },
                                radius: rest.radius,
                                owner: rest.owner,
                            })),
                        }
                      : {}),
              }
            : null,
    }
}
