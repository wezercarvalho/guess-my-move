import { RECONNECT_GRACE_MS } from '@guess-my-move/marbles'
import { describe, expect, it } from 'vitest'

import { RoomError, RoomService } from '../src/multiplayer/room.service.js'

function harness(options: { maxRooms?: number; finishedTimeoutMs?: number } = {}) {
    let now = 10_000
    const codes = ['ABCDEF', 'GHJKMN', 'PQRSTU']
    const tokens = ['a'.repeat(32), 'b'.repeat(32), 'c'.repeat(32), 'd'.repeat(32)]
    const service = new RoomService({
        now: () => now,
        code: () => codes.shift() ?? 'VWXYZ2',
        token: () => tokens.shift() ?? 'z'.repeat(32),
        maxRooms: options.maxRooms ?? 10,
        finishedTimeoutMs: options.finishedTimeoutMs ?? 300_000,
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
            const initial = h.service.setReady('guest', { ready: true })
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
            expect(h.advanceClock(299_999).expired).toEqual([])
            h.service.setRematchReady('host',{ready:true,matchNumber:1})
            const replay=h.service.setRematchReady('guest',{ready:true,matchNumber:1})
            expect(replay).toMatchObject({modeId,matchNumber:2,status:'playing',match:{round:0,roundOutcomes:[]}})
            expect(replay.match?.field).toEqual(initial.match?.field)
            expect(h.advanceClock(2).expired).toEqual([])
        })
    }
})

describe('RoomService: regressões antes do teste com câmera', () => {
    it('retoma anfitriã sozinha e continua permitindo a entrada de convidado', () => {
        const { service } = harness()
        const host = service.create('host', { modeId: 'bete' })
        service.disconnect('host')
        const resumed = service.resume('host-new', { roomCode: host.access.roomCode, resumeToken: host.access.resumeToken })
        expect(resumed.state.status).toBe('waiting')
        expect(service.join('guest', { roomCode: host.access.roomCode }).state.status).toBe('ready')
        service.setReady('host-new', { ready: true })
        expect(service.setReady('guest', { ready: true }).match).not.toBeNull()
    })

    it('não altera prontidão durante pausa por conexão ausente', () => {
        const { service } = harness()
        service.create('host', { modeId: 'bete' })
        service.join('guest', { roomCode: 'ABCDEF' })
        service.setReady('host', { ready: true })
        service.disconnect('host')
        expectRoomError(() => service.setReady('guest', { ready: true }), 'NOT_READY')
        expect(service.state('ABCDEF')).toMatchObject({ status: 'paused', players: { opponent: { ready: false } } })
    })

    it('publica a bolinha do competidor da vez na Cova antes da mira', () => {
        const h = harness()
        h.service.create('host', { modeId: 'hole' })
        h.service.join('guest', { roomCode: 'ABCDEF' })
        h.service.setReady('host', { ready: true })
        const initial = h.service.setReady('guest', { ready: true }).match?.field[0]?.pos
        h.service.submitShot('host', { seq: 1, velocity: { x: 150, y: 0 } })
        h.advanceClock(450)
        let moved: { x: number; y: number } | undefined
        for (let i = 0; i < 100; i++) {
            const state = h.service.state('ABCDEF')
            if (state?.match?.phase !== 'rolling') break
            moved = state.match.field[0]?.pos
            h.advanceClock(50)
        }
        const guestTurn = h.service.state('ABCDEF')
        expect(guestTurn?.match?.turn).toBe('opponent')
        expect(moved).not.toEqual(initial)
        expect(guestTurn?.match?.field[0]?.pos).toEqual(initial)
        expect(guestTurn?.match?.decor?.resting).toContainEqual(expect.objectContaining({ owner: 'player' }))
    })
})


describe('RoomService: identidade e revanche', () => {
    it('preserva nomes e recusa apelido repetido sem ocupar a vaga', () => {
        const h=harness()
        h.service.create('host',{modeId:'bete',nickname:'Ana'})
        expectRoomError(()=>h.service.join('duplicate',{roomCode:'ABCDEF',nickname:'ana'}),'NICKNAME_TAKEN')
        const guest=h.service.join('guest',{roomCode:'ABCDEF',nickname:'Bia'})
        expect(guest.state.players.player.nickname).toBe('Ana')
        expect(guest.state.players.opponent.nickname).toBe('Bia')
        h.service.disconnect('guest')
        expect(h.service.resume('guest-new',{roomCode:'ABCDEF',resumeToken:guest.access.resumeToken}).state.players.opponent.nickname).toBe('Bia')
    })

    it('nova partida exige ambos, aceita cancelamento e rejeita comandos da partida anterior', () => {
        const h=harness()
        h.service.create('host',{modeId:'bete',nickname:'Ana'})
        h.service.join('guest',{roomCode:'ABCDEF',nickname:'Bia'})
        expectRoomError(()=>h.service.setRematchReady('host',{ready:true,matchNumber:1}),'NOT_READY')
        h.service.setReady('host',{ready:true});h.service.setReady('guest',{ready:true})
        let seq=0
        for(let guard=0;guard<20000;guard++) {
            const state=h.service.state('ABCDEF')!
            if(state.status==='finished')break
            const match=state.match!
            if(match.phase==='player-turn'||match.phase==='opponent-turn') {
                h.service.submitShot(match.turn==='player'?'host':'guest',{seq:++seq,velocity:{x:150,y:0}})
                h.advanceClock(450)
            } else h.advanceClock(match.phase==='round-over'?950:50)
        }
        const final=h.service.state('ABCDEF')!
        expect(final.status).toBe('finished')
        const first=h.service.setRematchReady('host',{ready:true,matchNumber:1})
        expect(first.match).toEqual(final.match)
        expect(first.players.player.rematchReady).toBe(true)
        expect(h.service.setRematchReady('host',{ready:false,matchNumber:1}).players.player.rematchReady).toBe(false)
        h.service.setRematchReady('host',{ready:true,matchNumber:1})
        h.service.disconnect('guest')
        expectRoomError(()=>h.service.setRematchReady('host',{ready:false,matchNumber:1}),'NOT_READY')
        h.service.resume('guest-new',{roomCode:'ABCDEF',resumeToken:'b'.repeat(32)})
        const replay=h.service.setRematchReady('guest-new',{ready:true,matchNumber:1})
        expect(replay).toMatchObject({roomCode:'ABCDEF',status:'playing',matchNumber:2,nextTurn:'opponent',players:{player:{nickname:'Ana',rematchReady:false},opponent:{nickname:'Bia',rematchReady:false}},match:{round:0,turn:'player',roundOutcomes:[]}})
        expect(replay.version).toBeGreaterThan(final.version)
        expectRoomError(()=>h.service.setRematchReady('host',{ready:true,matchNumber:1}),'STALE_MATCH')
        expectRoomError(()=>h.service.submitShot('host',{seq:++seq,matchNumber:1,velocity:{x:150,y:0}}),'STALE_MATCH')
        expect(h.service.submitShot('host',{seq:++seq,matchNumber:2,velocity:{x:150,y:0}}).intent).not.toBeNull()
    })
})
