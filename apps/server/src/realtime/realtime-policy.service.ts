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
    constructor(@Inject(SERVER_CONFIG) private readonly cfg: ServerConfig) {
        super(cfg)
    }
    address(client: Socket): string {
        return clientAddress(
            client.handshake?.address ?? '',
            client.handshake?.headers['x-forwarded-for'],
            this.cfg.trustedProxyIps,
        )
    }
    allowOrigin(origin: string | undefined): boolean {
        return isAllowedOrigin(origin, this.cfg)
    }
}
