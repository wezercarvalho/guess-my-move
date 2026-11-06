import { io, type Socket } from 'socket.io-client'
import { createServerApp } from '../src/app.setup.js'
import { RoomBudget } from '../src/realtime/room-budget.service.js'
import { describe, expect, it, vi } from 'vitest'
import { RealtimePolicy } from '../src/realtime/realtime-policy.service.js'
import { loadServerConfig } from '../src/server-config.js'
import { BackendTelemetry } from '../src/observability/backend-telemetry.service.js'
import { BackendMetrics } from '../src/realtime/backend-metrics.service.js'

describe('infraestrutura realtime compartilhada', () => {
    it('compartilha teto e orçamento entre os jogos e preserva o orçamento após sair', () => {
        const policy = new RealtimePolicy(
            loadServerConfig({
                MAX_CONNECTIONS: '2',
                MAX_CONNECTIONS_PER_IP: '1',
                ROOM_ATTEMPTS_PER_MINUTE: '1',
            }),
        )
        expect(policy.connect('marbles-socket', '127.0.0.1')).toBe(true)
        expect(policy.connect('swing-socket', '127.0.0.1')).toBe(false)
        expect(policy.acceptRoomAttempt('127.0.0.1')).toBe(true)
        policy.disconnect('marbles-socket')
        expect(policy.connect('swing-socket', '127.0.0.1')).toBe(true)
        expect(policy.acceptRoomAttempt('127.0.0.1')).toBe(false)
        expect(policy.connect('second-address', '127.0.0.2')).toBe(true)
        expect(policy.connect('third-address', '127.0.0.3')).toBe(false)
    })
    it('agrega fontes de salas sem depender dos gateways', () => {
        const policy = new RealtimePolicy(loadServerConfig({}))
        const budget = new RoomBudget()
        const metrics = new BackendMetrics(
            new BackendTelemetry(),
            policy,
            budget,
        )
        budget.register('marbles', () => 2)
        budget.register('swing', () => 1)
        policy.connect('swing-socket', '127.0.0.1')
        expect(budget.canCreate(3)).toBe(false)
        expect(budget.canCreate(4)).toBe(true)
        expect(metrics.snapshot()).toMatchObject({
            activeRooms: 3,
            activeConnections: 1,
        })
    })
})

describe('capacidade global entre namespaces reais', () => {
    it('reserva MAX_ROOMS entre os jogos e libera o orçamento ao sair', async () => {
        vi.stubEnv('MAX_ROOMS', '1')
        const app = await createServerApp({ logger: false })
        const clients: Socket[] = []
        try {
            await app.listen(0, '127.0.0.1')
            const url = await app.getUrl()
            const connect = async (namespace: string) => {
                const socket = io(url + namespace, {
                    transports: ['websocket'],
                    reconnection: false,
                    extraHeaders: { Origin: 'http://localhost:5173' },
                })
                clients.push(socket)
                await new Promise<void>((resolve, reject) => {
                    socket.once('connect', resolve)
                    socket.once('connect_error', reject)
                })
                return socket
            }
            const marbles = await connect('')
            const swing = await connect('/swing')
            const ack = (
                socket: Socket,
                event: string,
                payload: unknown,
            ): Promise<unknown> =>
                new Promise((resolve) => socket.emit(event, payload, resolve))
            expect(
                await ack(marbles, 'room:create', { modeId: 'bete' }),
            ).toMatchObject({ ok: true })
            expect(
                await ack(swing, 'swing:create', {
                    cityId: 'aurora',
                    nickname: 'Ana',
                }),
            ).toMatchObject({ ok: false, error: { code: 'capacity' } })
            expect(await ack(marbles, 'room:leave', {})).toMatchObject({
                ok: true,
            })
            expect(
                await ack(swing, 'swing:create', {
                    cityId: 'aurora',
                    nickname: 'Ana',
                }),
            ).toMatchObject({ ok: true })
            expect(
                await ack(marbles, 'room:create', { modeId: 'bete' }),
            ).toMatchObject({ ok: false, error: { code: 'ROOM_LIMIT' } })
            expect(app.get(RoomBudget).activeRooms).toBe(1)
            const response = await fetch(`${url}/api/capabilities`)
            expect(await response.json()).toMatchObject({
                games: {
                    swing: {
                        namespace: '/swing',
                        cooperative: true,
                        maxPlayers: 2,
                    },
                },
            })
        } finally {
            clients.forEach((client) => client.disconnect())
            await app.close()
            vi.unstubAllEnvs()
        }
    })
})
