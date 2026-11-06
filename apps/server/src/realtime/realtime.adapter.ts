import type { INestApplicationContext } from '@nestjs/common'
import { IoAdapter } from '@nestjs/platform-socket.io'
import type { ServerOptions, Server } from 'socket.io'
import { MAX_SOCKET_PAYLOAD_BYTES } from '@guess-my-move/marbles'
import { RealtimePolicy } from './realtime-policy.service.js'
import { BackendTelemetry } from '../observability/backend-telemetry.service.js'

/** Origem é verificada no handshake Engine.IO, inclusive acesso direto a /swing. */
export class RealtimeAdapter extends IoAdapter {
    constructor(
        app: INestApplicationContext,
        private readonly policy: RealtimePolicy,
        private readonly telemetry: BackendTelemetry,
    ) {
        super(app, { maxConcurrentMessages: 16 })
    }
    override createIOServer(port: number, options?: ServerOptions): Server {
        // Socket.IO completa os defaults; a assinatura da plataforma exige ServerOptions completo.
        return super.createIOServer(port, {
            ...options!,
            transports: ['websocket'],
            maxHttpBufferSize: MAX_SOCKET_PAYLOAD_BYTES,
            cors: { origin: false },
            allowRequest: (request, callback) => {
                const allowed = this.policy.allowOrigin(request.headers.origin)
                if (!allowed) {
                    this.telemetry.counters.rejectedOrigins++
                    callback(null, false)
                    return
                }
                if (!this.policy.admitTransport(request)) {
                    this.telemetry.counters.rejectedConnections++
                    callback(null, false)
                    return
                }
                callback(null, true)
            },
        })
    }
}
