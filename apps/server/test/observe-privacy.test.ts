import { createServer, type Server } from 'node:http'
import { gunzipSync } from 'node:zlib'
import type { AddressInfo } from 'node:net'
import { setTimeout as delay } from 'node:timers/promises'
import type { INestApplication } from '@nestjs/common'
import { io, type Socket } from 'socket.io-client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CLIENT_EVENTS } from '@guess-my-move/marbles'
import { RoomService } from '../src/multiplayer/room.service.js'
import { createServerApp } from '../src/app.setup.js'
import { BackendTelemetry } from '../src/observability/backend-telemetry.service.js'

let collector: Server | undefined
let app: INestApplication | undefined
let client: Socket | undefined
const batches: string[] = []
async function startCollector() {
    batches.length = 0
    collector = createServer((request, response) => {
        const chunks: Buffer[] = []
        request.on('data', (chunk: Buffer) => chunks.push(chunk))
        request.on('end', () => {
            const bytes = Buffer.concat(chunks)
            batches.push(
                (request.headers['content-encoding'] === 'gzip'
                    ? gunzipSync(bytes)
                    : bytes
                ).toString('utf8'),
            )
            response
                .writeHead(200, { 'Content-Type': 'application/json' })
                .end('{}')
        })
    })
    await new Promise<void>((resolve) =>
        collector!.listen(0, '127.0.0.1', resolve),
    )
    return `http://127.0.0.1:${(collector.address() as AddressInfo).port}`
}
afterEach(async () => {
    client?.disconnect()
    client = undefined
    await app?.close()
    app = undefined
    if (collector)
        await new Promise<void>((resolve, reject) =>
            collector!.close((error) => (error ? reject(error) : resolve())),
        )
    collector = undefined
    vi.unstubAllEnvs()
})

describe('coleta externa opt-in', () => {
    it('não envia nem uma requisição ao coletor quando desativado', async () => {
        vi.stubEnv('OBSERVE_ENDPOINT', await startCollector())
        vi.stubEnv('OBSERVE_APP_KEY', 'private-key-for-tests')
        vi.stubEnv('OBSERVE_APP_SECRET', 'private-secret-for-tests')
        vi.stubEnv('OBSERVE_ENABLED', 'false')
        app = await createServerApp({ logger: false })
        await app.listen(0, '127.0.0.1')
        const url = await app.getUrl()
        await fetch(`${url}/api/capabilities`)
        app.get(BackendTelemetry).record('room:create', false, 1)
        await app.close()
        app = undefined
        expect(batches).toEqual([])
    })
    it('envia agregados ao stub local sem payload, headers, identificadores ou credencial de retomada', async () => {
        vi.stubEnv('OBSERVE_ENDPOINT', await startCollector())
        vi.stubEnv('OBSERVE_APP_KEY', 'private-key-for-tests')
        vi.stubEnv('OBSERVE_APP_SECRET', 'private-secret-for-tests')
        vi.stubEnv('OBSERVE_ENABLED', 'true')
        vi.stubEnv('OBSERVE_SAMPLE_RATE', '1')
        vi.stubEnv(
            'METRICS_TOKEN',
            'MetricsPrivateSentinel-credential-32-chars',
        )
        app = await createServerApp({ logger: false })
        await app.listen(0, '127.0.0.1')
        const url = await app.getUrl()
        await fetch(`${url}/api/health`)
        await fetch(`${url}/api/capabilities?untrusted=QueryPrivateSentinel`, {
            headers: { 'X-Request-Id': 'HeaderPrivateSentinel' },
        })
        client = io(url, {
            transports: ['websocket'],
            reconnection: false,
            extraHeaders: {
                Origin: 'http://localhost:5173',
                'X-Forwarded-For': '203.0.113.71',
            },
        })
        await new Promise<void>((resolve, reject) => {
            client!.once('connect', resolve)
            client!.once('connect_error', reject)
        })
        const ack: unknown = await new Promise((resolve) =>
            client!.emit(
                CLIENT_EVENTS.create,
                { modeId: 'bete', nickname: 'NicknameSentinel' },
                resolve,
            ),
        )
        expect(ack).toMatchObject({ ok: true })
        await new Promise((resolve) =>
            client!.emit(
                CLIENT_EVENTS.create,
                { modeId: 'bete', frame: 'MediaPrivateSentinel' },
                resolve,
            ),
        )
        const fault = vi
            .spyOn(RoomService.prototype, 'create')
            .mockImplementationOnce(() => {
                throw new Error('ErrorPrivateSentinel')
            })
        try {
            await new Promise((resolve) =>
                client!.emit(CLIENT_EVENTS.create, { modeId: 'bete' }, resolve),
            )
        } finally {
            fault.mockRestore()
        }
        await fetch(`${url}/api/metrics`, {
            headers: {
                Authorization:
                    'Bearer MetricsPrivateSentinel-credential-32-chars',
            },
        })
        app.get(BackendTelemetry).record('room:create', false, 12)
        for (
            let i = 0;
            i < 40 &&
            !batches.some(
                (body) =>
                    body.includes('MultiplayerGateway:room:create') &&
                    body.includes('backend_operations_room_create'),
            );
            i++
        )
            await delay(100)
        await app.close()
        app = undefined
        expect(
            batches.some((body) =>
                body.includes('backend_operations_room_create'),
            ),
        ).toBe(true)
        const text = batches.join('\n')
        expect(text).toContain('MultiplayerGateway:room:create')
        expect(text).toContain('HealthController')
        expect(text).toContain('/api/health')
        for (const sentinel of [
            'QueryPrivateSentinel',
            'HeaderPrivateSentinel',
            'NicknameSentinel',
            'MediaPrivateSentinel',
            'ErrorPrivateSentinel',
            'MetricsPrivateSentinel',
            '203.0.113.71',
            'private-secret-for-tests',
        ])
            expect(text).not.toContain(sentinel)
        if (ack && typeof ack === 'object' && 'access' in ack) {
            const access = Reflect.get(ack, 'access') as { resumeToken: string }
            expect(text).not.toContain(access.resumeToken)
        }
    }, 10_000)
})
