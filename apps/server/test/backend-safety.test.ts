import { describe, expect, it } from 'vitest'
import { RoomService } from '../src/multiplayer/room.service.js'
import {
    ConnectionAdmission,
    clientAddress,
    isAllowedOrigin,
} from '../src/multiplayer/admission.js'
import { loadServerConfig } from '../src/server-config.js'

const config = () => loadServerConfig({})

describe('expiração por atividade', () => {
    it('libera capacidade de sala conectada sem atividade e não renova por leitura ou prontidão idempotente', () => {
        let now = 0
        const rooms = new RoomService({
            now: () => now,
            maxRooms: 1,
            waitingTimeoutMs: 1000,
        })
        const first = rooms.create('host', { modeId: 'bete' })
        now = 900
        rooms.state(first.access.roomCode)
        rooms.setReady('host', { ready: false })
        now = 1000
        expect(rooms.tick(33).expired).toEqual([first.access.roomCode])
        expect(rooms.create('new', { modeId: 'bete' }).state.status).toBe(
            'waiting',
        )
    })

    it('mantém pausa por toda a janela de reconexão e renova a atividade ao retomar', () => {
        let now = 0
        const rooms = new RoomService({
            now: () => now,
            waitingTimeoutMs: 1000,
        })
        const first = rooms.create('host', { modeId: 'bete' })
        now = 900
        rooms.disconnect('host')
        now = 20_000
        expect(rooms.tick(33).expired).toEqual([])
        rooms.resume('returned', {
            roomCode: first.access.roomCode,
            resumeToken: first.access.resumeToken,
        })
        now = 20_999
        expect(rooms.tick(33).expired).toEqual([])
        now = 21_000
        expect(rooms.tick(33).expired).toEqual([first.access.roomCode])
    })

    it('usa prazo de jogo independente do prazo de espera', () => {
        let now = 0
        const rooms = new RoomService({
            now: () => now,
            waitingTimeoutMs: 100,
            idleTimeoutMs: 1000,
        })
        const first = rooms.create('host', { modeId: 'bete' })
        rooms.join('guest', { roomCode: first.access.roomCode })
        rooms.setReady('host', { ready: true })
        rooms.setReady('guest', { ready: true })
        now = 101
        expect(rooms.tick(33).expired).toEqual([])
        now = 1000
        expect(rooms.tick(33).expired).toEqual([first.access.roomCode])
    })
})

describe('prazo de revanche', () => {
    it('expira uma partida concluída após a janela, sem renovar por confirmação idempotente', () => {
        let now = 0
        const rooms = new RoomService({
            now: () => now,
            finishedTimeoutMs: 1000,
        })
        const room = rooms.create('host', { modeId: 'bete' })
        rooms.join('guest', { roomCode: room.access.roomCode })
        rooms.setReady('host', { ready: true })
        rooms.setReady('guest', { ready: true })
        let seq = 0
        for (let i = 0; i < 20_000; i++) {
            const state = rooms.state(room.access.roomCode)!
            if (state.status === 'finished') break
            const match = state.match!
            if (
                !state.intent &&
                (match.phase === 'player-turn' ||
                    match.phase === 'opponent-turn')
            ) {
                rooms.submitShot(match.turn === 'player' ? 'host' : 'guest', {
                    seq: ++seq,
                    velocity: { x: 150, y: 0 },
                })
            }
            now += 50
            rooms.tick(50)
        }
        expect(rooms.state(room.access.roomCode)?.status).toBe('finished')
        now += 999
        rooms.setRematchReady('host', { ready: false, matchNumber: 1 })
        expect(rooms.tick(33).expired).toEqual([])
        now++
        expect(rooms.tick(33).expired).toEqual([room.access.roomCode])
    })
})

describe('admissão e orçamento agregado', () => {
    it('permite apenas origens explícitas e trata ausência de origem como política separada', () => {
        expect(isAllowedOrigin('http://localhost:5173', config())).toBe(true)
        expect(isAllowedOrigin('https://other.invalid', config())).toBe(false)
        expect(isAllowedOrigin(undefined, config())).toBe(false)
        expect(
            isAllowedOrigin(undefined, { ...config(), allowOriginless: true }),
        ).toBe(true)
    })

    it('recusa novas conexões acima do limite por endereço ou global e libera na desconexão', () => {
        const admission = new ConnectionAdmission({
            ...config(),
            maxConnections: 2,
            maxConnectionsPerIp: 1,
        })
        expect(admission.connect('a', 'one')).toBe(true)
        expect(admission.connect('b', 'one')).toBe(false)
        expect(admission.connect('c', 'two')).toBe(true)
        expect(admission.connect('d', 'three')).toBe(false)
        admission.disconnect('a')
        expect(admission.connect('d', 'three')).toBe(true)
    })

    it('preserva o orçamento entre sockets e limita o armazenamento de endereços', () => {
        let now = 0
        const admission = new ConnectionAdmission(
            { ...config(), roomAttemptsPerMinute: 2, maxTrackedAddresses: 1 },
            () => now,
        )
        expect(admission.acceptRoomAttempt('one')).toBe(true)
        expect(admission.acceptRoomAttempt('one')).toBe(true)
        expect(admission.acceptRoomAttempt('one')).toBe(false)
        expect(admission.acceptRoomAttempt('two')).toBe(false)
        now = 60_001
        expect(admission.acceptRoomAttempt('two')).toBe(true)
    })

    it('ignora IP encaminhado de peer não confiável e percorre apenas proxies confiáveis', () => {
        expect(clientAddress('10.0.0.1', '203.0.113.7', [])).toBe('10.0.0.1')
        expect(
            clientAddress('::ffff:127.0.0.1', '203.0.113.7, 10.0.0.2', [
                '127.0.0.1',
                '10.0.0.2',
            ]),
        ).toBe('203.0.113.7')
        expect(clientAddress('127.0.0.1', 'spoofed', ['127.0.0.1'])).toBe(
            '127.0.0.1',
        )
    })

    it('recusa configuração malformada em vez de alargar acesso silenciosamente', () => {
        for (const env of [
            { ALLOWED_ORIGINS: '*' },
            { TRUSTED_PROXY_IPS: '*' },
            { MAX_CONNECTIONS: '0' },
            { ALLOW_ORIGINLESS_CLIENTS: 'yes' },
        ]) {
            expect(() => loadServerConfig(env)).toThrow()
        }
    })
})
