import { RECONNECT_GRACE_MS } from '@guess-my-move/marbles'
import { describe, expect, it } from 'vitest'

import { RoomError, RoomService } from '../src/multiplayer/room.service.js'

function harness(options: { maxRooms?: number } = {}) {
    let now = 10_000
    const codes = ['ABCDEF', 'GHJKMN', 'PQRSTU']
    const tokens = ['a'.repeat(32), 'b'.repeat(32), 'c'.repeat(32), 'd'.repeat(32)]
    const service = new RoomService({
        now: () => now,
        code: () => codes.shift() ?? 'VWXYZ2',
        token: () => tokens.shift() ?? 'z'.repeat(32),
        maxRooms: options.maxRooms ?? 10,
        shotPreviewMs: 450,
        roundDwellMs: 900,
    })
    return {
        service,
        advanceClock(ms: number) {
            now += ms
            return service.tick(ms)
        },
    }
}

function expectRoomError(action: () => unknown, code: RoomError['code']): void {
    try {
        action()
        throw new Error('esperava RoomError')
    } catch (error) {
        expect(error).toBeInstanceOf(RoomError)
        expect((error as RoomError).code).toBe(code)
    }
}

describe('RoomService: ciclo da sala', () => {
    it('cria código de seis caracteres, papéis estáveis e limita a duas conexões', () => {
        const { service } = harness()
        const host = service.create('socket-host', { modeId: 'bete' })
        expect(host.access).toEqual({
            roomCode: 'ABCDEF',
            role: 'player',
            resumeToken: 'a'.repeat(32),
        })
        expect(host.state).toMatchObject({
            roomCode: 'ABCDEF',
            modeId: 'bete',
            status: 'waiting',
            version: 0,
            players: {
                player: { connected: true, ready: false },
                opponent: { connected: false, ready: false },
            },
        })

        const guest = service.join('socket-guest', { roomCode: 'ABCDEF' })
        expect(guest.access.role).toBe('opponent')
        expect(guest.state.status).toBe('ready')
        expectRoomError(
            () => service.join('socket-third', { roomCode: 'ABCDEF' }),
            'ROOM_FULL',
        )
    })

    it('recusa código ausente, sala iniciada e limite global de salas', () => {
        const limited = harness({ maxRooms: 1 }).service
        limited.create('one', { modeId: 'triangle' })
        expectRoomError(() => limited.create('two', { modeId: 'hole' }), 'ROOM_LIMIT')
        expectRoomError(() => limited.join('three', { roomCode: 'ZZZZZZ' }), 'ROOM_NOT_FOUND')

        const { service } = harness()
        service.create('host', { modeId: 'bete' })
        service.join('guest', { roomCode: 'ABCDEF' })
        service.setReady('host', { ready: true })
        service.setReady('guest', { ready: true })
        expectRoomError(() => service.join('late', { roomCode: 'ABCDEF' }), 'ROOM_STARTED')
    })

    it('começa uma única sessão remota quando as duas pessoas ficam prontas', () => {
        const { service } = harness()
        service.create('host', { modeId: 'triangle' })
        service.join('guest', { roomCode: 'ABCDEF' })
        expect(service.setReady('host', { ready: true }).status).toBe('ready')
        const started = service.setReady('guest', { ready: true })
        expect(started.status).toBe('playing')
        expect(started.match).toMatchObject({
            modeId: 'triangle',
            opponent: 'remote',
            phase: 'player-turn',
            turn: 'player',
        })
        expect(service.setReady('guest', { ready: true }).match).toEqual(started.match)
    })
})

describe('RoomService: autoridade e sequência', () => {
    function started() {
        const h = harness()
        h.service.create('host', { modeId: 'bete' })
        h.service.join('guest', { roomCode: 'ABCDEF' })
        h.service.setReady('host', { ready: true })
        h.service.setReady('guest', { ready: true })
        return h
    }

    it('aceita uma vez, anuncia e só aplica o tiro de quem está na vez', () => {
        const h = started()
        expectRoomError(
            () => h.service.submitShot('guest', { seq: 1, velocity: { x: 300, y: 0 } }),
            'NOT_YOUR_TURN',
        )

        const announced = h.service.submitShot('host', {
            seq: 1,
            velocity: { x: 300, y: 0 },
        })
        expect(announced.intent).toEqual({
            competitor: 'player',
            velocity: { x: 300, y: 0 },
        })
        expect(announced.match?.phase).toBe('player-turn')
        expectRoomError(
            () => h.service.submitShot('host', { seq: 1, velocity: { x: 300, y: 0 } }),
            'DUPLICATE_COMMAND',
        )

        h.advanceClock(449)
        expect(h.service.state('ABCDEF')?.match?.phase).toBe('player-turn')
        h.advanceClock(1)
        expect(h.service.state('ABCDEF')).toMatchObject({
            intent: null,
            match: { phase: 'rolling', turn: 'player' },
        })
    })

    it('não aceita outro tiro durante a prévia ou a rolagem', () => {
        const h = started()
        h.service.submitShot('host', { seq: 1, velocity: { x: 300, y: 0 } })
        expectRoomError(
            () => h.service.submitShot('host', { seq: 2, velocity: { x: 300, y: 0 } }),
            'NOT_READY',
        )
        h.advanceClock(450)
        expectRoomError(
            () => h.service.submitShot('host', { seq: 2, velocity: { x: 300, y: 0 } }),
            'NOT_READY',
        )
    })
})

describe('RoomService: desconexão e retomada', () => {
    function started() {
        const h = harness()
        const host = h.service.create('host', { modeId: 'hole' })
        const guest = h.service.join('guest', { roomCode: host.access.roomCode })
        h.service.setReady('host', { ready: true })
        h.service.setReady('guest', { ready: true })
        return { ...h, host, guest }
    }

    it('pausa sem avançar e retoma o mesmo papel/snapshot dentro de 60 segundos', () => {
        const h = started()
        const before = h.service.state('ABCDEF')?.match
        const paused = h.service.disconnect('guest')
        expect(paused).toMatchObject({
            status: 'paused',
            reconnectDeadlineMs: 10_000 + RECONNECT_GRACE_MS,
            players: { opponent: { connected: false, ready: true } },
        })

        h.advanceClock(RECONNECT_GRACE_MS - 1)
        expect(h.service.state('ABCDEF')?.match).toEqual(before)
        const resumed = h.service.resume('guest-new', {
            roomCode: 'ABCDEF',
            resumeToken: h.guest.access.resumeToken,
        })
        expect(resumed.access.role).toBe('opponent')
        expect(resumed.state.status).toBe('playing')
        expect(resumed.state.match).toEqual(before)
    })

    it('rejeita token incorreto e remove a sala depois da janela', () => {
        const h = started()
        h.service.disconnect('guest')
        expectRoomError(
            () =>
                h.service.resume('intruder', {
                    roomCode: 'ABCDEF',
                    resumeToken: 'x'.repeat(32),
                }),
            'RESUME_DENIED',
        )
        const result = h.advanceClock(RECONNECT_GRACE_MS + 1)
        expect(result.expired).toEqual(['ABCDEF'])
        expect(h.service.state('ABCDEF')).toBeUndefined()
    })
})


describe('RoomService: partida completa por modo', () => {
    for (const modeId of ['bete', 'triangle', 'hole'] as const) {
        it(`conclui ${modeId} com duas fontes remotas`, () => {
            const h = harness()
            h.service.create('host', { modeId })
            h.service.join('guest', { roomCode: 'ABCDEF' })
            h.service.setReady('host', { ready: true })
            h.service.setReady('guest', { ready: true })
            let playerSeq = 0
            let opponentSeq = 0
            let guard = 0

            while (guard++ < 20_000) {
                const state = h.service.state('ABCDEF')
                if (!state?.match || state.status === 'finished') break
                switch (state.match.phase) {
                    case 'player-turn':
                        h.service.submitShot('host', {
                            seq: ++playerSeq,
                            velocity: { x: 150, y: 0 },
                        })
                        h.advanceClock(450)
                        break
                    case 'opponent-turn':
                        h.service.submitShot('guest', {
                            seq: ++opponentSeq,
                            velocity: { x: -150, y: 0 },
                        })
                        h.advanceClock(450)
                        break
                    case 'rolling':
                        h.advanceClock(50)
                        break
                    case 'round-over':
                        h.advanceClock(950)
                        break
                    default:
                        h.advanceClock(50)
                }
            }

            const final = h.service.state('ABCDEF')
            expect(guard).toBeLessThan(20_000)
            expect(final?.status).toBe('finished')
            expect(final?.match?.phase).toBe('match-over')
            expect(final?.match?.roundOutcomes).toHaveLength(3)
        })
    }
})
