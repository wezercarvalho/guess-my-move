import { randomUUID } from 'node:crypto'
import type { IncomingMessage } from 'node:http'
import type { Duplex } from 'node:stream'
import { Inject, Injectable } from '@nestjs/common'
import type { Socket } from 'socket.io'
import { SERVER_CONFIG, type ServerConfig } from '../server-config.js'
import {
    ConnectionAdmission,
    clientAddress,
    isAllowedOrigin,
} from './admission.js'

/** Uma única admissão por processo: namespaces não multiplicam os tetos. */
@Injectable()
export class RealtimePolicy extends ConnectionAdmission {
    private readonly transports: ConnectionAdmission
    private readonly transportIds = new WeakMap<Duplex, string>()
    constructor(@Inject(SERVER_CONFIG) private readonly cfg: ServerConfig) {
        super(cfg)
        this.transports = new ConnectionAdmission(cfg)
    }
    address(client: Socket): string {
        return clientAddress(
            client.handshake?.address ?? '',
            client.handshake?.headers['x-forwarded-for'],
            this.cfg.trustedProxyIps,
        )
    }
    /** WebSocket exclusivo: a reserva vive até o fechamento físico do socket. */
    admitTransport(request: IncomingMessage): boolean {
        const socket = request.socket
        if (socket.destroyed) return false
        if (this.transportIds.has(socket)) return true
        const address = clientAddress(
            socket.remoteAddress ?? '',
            request.headers['x-forwarded-for'],
            this.cfg.trustedProxyIps,
        )
        const id = randomUUID()
        if (!this.transports.connect(id, address)) return false
        this.transportIds.set(socket, id)
        socket.once('close', () => {
            this.transportIds.delete(socket)
            this.transports.disconnect(id)
        })
        return true
    }
    get activeTransports(): number {
        return this.transports.activeConnections
    }
    allowOrigin(origin: string | undefined): boolean {
        return isAllowedOrigin(origin, this.cfg)
    }
}
