import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import {
    HttpException,
    NotFoundException,
    ServiceUnavailableException,
    UnauthorizedException,
} from '@nestjs/common'
import {
    cardMaxDurationMs,
    createRound,
    getCardById,
    scoreCardRound,
    toPublicCard,
    type Card,
    type CardRoundAccess,
    type CardRoundSnapshot,
    type ObserveCardRound,
    type Round,
    type StartCardRound,
} from '@guess-my-move/core'

interface Session {
    card: Card
    round: Round
    token: string
    expiresAt: number
    lastSeq: number
    lastObservationAt: number
    final: CardRoundSnapshot | null
}
interface Options {
    now?: () => number
    maxRounds?: number
}

/** Ephemeral authority: only server clock, deck and referee can award points. */
export class CardRoundsService {
    private readonly sessions = new Map<string, Session>()
    private readonly now: () => number
    private readonly maxRounds: number
    constructor(options: Options = {}) {
        this.now = options.now ?? (() => performance.now())
        this.maxRounds = options.maxRounds ?? 100
    }
    get activeRounds(): number {
        return this.sessions.size
    }
    sweep(): void {
        const now = this.now()
        for (const [id, session] of this.sessions)
            if (now >= session.expiresAt) this.sessions.delete(id)
    }
    start(command: StartCardRound): CardRoundAccess {
        this.sweep()
        const card = getCardById(command.cardId, command.locale)
        if (!card) throw new NotFoundException('Carta indisponível.')
        if (this.sessions.size >= this.maxRounds)
            throw new ServiceUnavailableException(
                'Capacidade de rodadas atingida.',
            )
        const round = createRound({ card, clock: this.now })
        round.revealCard()
        round.cameraReady()
        round.start()
        const session: Session = {
            card,
            round,
            token: randomBytes(24).toString('base64url'),
            expiresAt: this.now() + cardMaxDurationMs(card) + 30000,
            lastSeq: 0,
            lastObservationAt: -Infinity,
            final: null,
        }
        const roundId = randomUUID()
        this.sessions.set(roundId, session)
        return { roundId, token: session.token, round: this.snapshot(session) }
    }
    observe(
        id: string,
        token: string,
        command: ObserveCardRound,
    ): CardRoundSnapshot {
        const session = this.authorized(id, token)
        if (session.final) return session.final
        if (command.seq <= session.lastSeq)
            throw new HttpException('Sequência inválida.', 409)
        const now = this.now()
        if (now - session.lastObservationAt < 50)
            throw new HttpException(
                'Aguarde antes de enviar outra amostra.',
                429,
            )
        session.lastSeq = command.seq
        session.lastObservationAt = now
        session.round.tick()
        if (command.angleDeg !== null) session.round.observe(command.angleDeg)
        return this.snapshot(session)
    }
    cancel(id: string, token: string): CardRoundSnapshot {
        const session = this.authorized(id, token)
        // The deadline wins over a late cancellation, using the same server clock.
        session.round.tick()
        session.round.cancel()
        return this.snapshot(session)
    }
    private authorized(id: string, token: string): Session {
        this.sweep()
        const session = this.sessions.get(id)
        const candidate = Buffer.from(token)
        if (
            !session ||
            candidate.length !== Buffer.byteLength(session.token) ||
            !timingSafeEqual(candidate, Buffer.from(session.token))
        )
            throw new UnauthorizedException('Rodada indisponível.')
        return session
    }
    private snapshot(session: Session): CardRoundSnapshot {
        if (session.final) return session.final
        const state = session.round.state
        if (
            state !== 'detecting' &&
            state !== 'recognized' &&
            state !== 'timed_out' &&
            state !== 'user_cancelled'
        )
            throw new Error('Estado interno de rodada inválido.')
        const elapsedMs = Math.min(
            cardMaxDurationMs(session.card),
            Math.max(0, session.round.elapsedMs ?? 0),
        )
        const snapshot: CardRoundSnapshot = {
            card: toPublicCard(session.card),
            state,
            elapsedMs,
            maxDurationMs: cardMaxDurationMs(session.card),
            score: scoreCardRound(session.card, state, elapsedMs),
        }
        if (session.round.finished) session.final = Object.freeze(snapshot)
        return snapshot
    }
}
