import { connect as tcpConnect } from 'node:net'
import { Manager, type Socket } from 'socket.io-client'
import { describe, expect, it, vi } from 'vitest'
import { createServerApp } from '../src/app.setup.js'
import { BackendMetrics } from '../src/realtime/backend-metrics.service.js'
import { MultiplayerGateway } from '../src/multiplayer/multiplayer.gateway.js'

const options = {
    transports: ['websocket'],
    reconnection: false,
    autoConnect: false,
    timeout: 1000,
    extraHeaders: { Origin: 'http://localhost:5173' },
}
const open = (manager: Manager): Promise<void> =>
    new Promise((resolve, reject) =>
        manager.open((error) => (error ? reject(error) : resolve())),
    )
const join = (socket: Socket): Promise<void> =>
    new Promise((resolve, reject) => {
        socket.once('connect', resolve).once('connect_error', reject)
        socket.connect()
    })

describe('admissão antes dos namespaces', () => {
    it.each([
        { MAX_CONNECTIONS: '1', MAX_CONNECTIONS_PER_IP: '3' },
        { MAX_CONNECTIONS: '3', MAX_CONNECTIONS_PER_IP: '1' },
    ])(
        'recusa excesso de transporte sem CONNECT e libera após fechar ($MAX_CONNECTIONS/$MAX_CONNECTIONS_PER_IP)',
        async (limits) => {
            Object.entries(limits).forEach(([name, value]) =>
                vi.stubEnv(name, value),
            )
            const app = await createServerApp({ logger: false })
            const managers: Manager[] = []
            try {
                await app.listen(0, '127.0.0.1')
                const url = await app.getUrl()
                const one = new Manager(url, {
                    ...options,
                    extraHeaders: {
                        ...options.extraHeaders,
                        'X-Forwarded-For': '203.0.113.10',
                    },
                })
                managers.push(one)
                await open(one)
                expect(app.get(BackendMetrics).snapshot()).toMatchObject({
                    activeConnections: 0,
                    activeTransports: 1,
                })
                const rejected = new Manager(url, {
                    ...options,
                    extraHeaders: {
                        ...options.extraHeaders,
                        'X-Forwarded-For': '203.0.113.20',
                    },
                })
                managers.push(rejected)
                await expect(open(rejected)).rejects.toBeDefined()
                expect(one.engine.readyState).toBe('open')
                one.engine.close()
                await vi.waitFor(() =>
                    expect(app.get(BackendMetrics).snapshot()).toMatchObject({
                        activeTransports: 0,
                    }),
                )
                const next = new Manager(url, options)
                managers.push(next)
                await open(next)
                expect(app.get(BackendMetrics).snapshot()).toMatchObject({
                    activeConnections: 0,
                    activeTransports: 1,
                })
            } finally {
                managers.forEach((manager) => manager.engine?.close())
                await app.close()
                vi.unstubAllEnvs()
            }
        },
    )

    it('preserva endereços de clientes somente quando o peer é proxy confiável', async () => {
        vi.stubEnv('MAX_CONNECTIONS', '2')
        vi.stubEnv('MAX_CONNECTIONS_PER_IP', '1')
        vi.stubEnv('TRUSTED_PROXY_IPS', '127.0.0.1')
        const app = await createServerApp({ logger: false })
        const managers: Manager[] = []
        try {
            await app.listen(0, '127.0.0.1')
            const url = await app.getUrl()
            for (const address of ['203.0.113.10', '203.0.113.20']) {
                const manager = new Manager(url, {
                    ...options,
                    extraHeaders: {
                        ...options.extraHeaders,
                        'X-Forwarded-For': address,
                    },
                })
                managers.push(manager)
                await open(manager)
            }
            expect(app.get(BackendMetrics).snapshot()).toMatchObject({
                activeTransports: 2,
                activeConnections: 0,
            })
        } finally {
            managers.forEach((manager) => manager.engine?.close())
            await app.close()
            vi.unstubAllEnvs()
        }
    })

    it('reserva atomicamente entre handshakes concorrentes', async () => {
        vi.stubEnv('MAX_CONNECTIONS', '1')
        const app = await createServerApp({ logger: false })
        const managers: Manager[] = []
        try {
            await app.listen(0, '127.0.0.1')
            const url = await app.getUrl()
            managers.push(
                ...Array.from({ length: 4 }, () => new Manager(url, options)),
            )
            const results = await Promise.allSettled(managers.map(open))
            expect(
                results.filter((result) => result.status === 'fulfilled'),
            ).toHaveLength(1)
            expect(app.get(BackendMetrics).snapshot()).toMatchObject({
                activeConnections: 0,
                activeTransports: 1,
            })
        } finally {
            managers.forEach((manager) => manager.engine?.close())
            await app.close()
            vi.unstubAllEnvs()
        }
    })

    it('libera reserva após falha de upgrade e não reserva origem recusada', async () => {
        vi.stubEnv('MAX_CONNECTIONS', '1')
        const app = await createServerApp({ logger: false })
        const managers: Manager[] = []
        try {
            await app.listen(0, '127.0.0.1')
            const url = await app.getUrl(),
                port = Number(new URL(url).port)
            const response = await new Promise<string>((resolve, reject) => {
                const socket = tcpConnect(port, '127.0.0.1')
                let data = ''
                socket.setTimeout(1000, () =>
                    socket.destroy(new Error('Upgrade did not close')),
                )
                socket
                    .on('error', reject)
                    .on('data', (chunk) => {
                        data += String(chunk)
                    })
                    .on('close', () => resolve(data))
                socket.on('connect', () =>
                    socket.write(
                        `GET /socket.io/?EIO=4&transport=websocket HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: invalid\r\nOrigin: http://localhost:5173\r\n\r\n`,
                    ),
                )
            })
            expect(response).toContain('400')
            await vi.waitFor(() =>
                expect(app.get(BackendMetrics).snapshot()).toMatchObject({
                    activeTransports: 0,
                }),
            )
            const denied = new Manager(url, {
                ...options,
                extraHeaders: { Origin: 'https://not-allowed.invalid' },
            })
            managers.push(denied)
            await expect(open(denied)).rejects.toBeDefined()
            expect(app.get(BackendMetrics).snapshot()).toMatchObject({
                activeTransports: 0,
            })
            const valid = new Manager(url, options)
            managers.push(valid)
            await open(valid)
            expect(app.get(BackendMetrics).snapshot()).toMatchObject({
                activeTransports: 1,
            })
        } finally {
            managers.forEach((manager) => manager.engine?.close())
            await app.close()
            vi.unstubAllEnvs()
        }
    })

    it('encerra o transporte sem namespace no timeout e libera a capacidade', async () => {
        const app = await createServerApp({ logger: false })
        let manager: Manager | undefined
        try {
            await app.listen(0, '127.0.0.1')
            // API pública do Socket.IO: aceleração exclusivamente neste teste.
            const server = app.get(MultiplayerGateway).server
            expect(server.connectTimeout()).toBe(45000)
            server.connectTimeout(50)
            manager = new Manager(await app.getUrl(), options)
            await open(manager)
            await vi.waitFor(() =>
                expect(manager?.engine.readyState).toBe('closed'),
            )
            await vi.waitFor(() =>
                expect(app.get(BackendMetrics).snapshot()).toMatchObject({
                    activeTransports: 0,
                    activeConnections: 0,
                }),
            )
        } finally {
            manager?.engine?.close()
            await app.close()
        }
    })

    it('libera transportes ainda abertos ao encerrar a aplicação', async () => {
        const app = await createServerApp({ logger: false })
        let manager: Manager | undefined
        let closed = false
        try {
            await app.listen(0, '127.0.0.1')
            manager = new Manager(await app.getUrl(), options)
            await open(manager)
            const metrics = app.get(BackendMetrics)
            expect(metrics.snapshot()).toMatchObject({ activeTransports: 1 })
            await app.close()
            closed = true
            await vi.waitFor(() =>
                expect(metrics.snapshot()).toMatchObject({
                    activeTransports: 0,
                    activeConnections: 0,
                }),
            )
        } finally {
            manager?.engine?.close()
            if (!closed) await app.close()
        }
    })

    it('conta um transporte e duas sessões ao multiplexar os jogos', async () => {
        vi.stubEnv('MAX_CONNECTIONS', '2')
        const app = await createServerApp({ logger: false })
        let manager: Manager | undefined
        try {
            await app.listen(0, '127.0.0.1')
            manager = new Manager(await app.getUrl(), options)
            const marbles = manager.socket('/'),
                swing = manager.socket('/swing')
            await Promise.all([join(marbles), join(swing)])
            expect(app.get(BackendMetrics).snapshot()).toMatchObject({
                activeTransports: 1,
                activeConnections: 2,
            })
            marbles.disconnect()
            await vi.waitFor(() =>
                expect(app.get(BackendMetrics).snapshot()).toMatchObject({
                    activeTransports: 1,
                    activeConnections: 1,
                }),
            )
            swing.disconnect()
            await vi.waitFor(() =>
                expect(app.get(BackendMetrics).snapshot()).toMatchObject({
                    activeTransports: 0,
                    activeConnections: 0,
                }),
            )
        } finally {
            manager?.engine?.close()
            await app.close()
            vi.unstubAllEnvs()
        }
    })
})
