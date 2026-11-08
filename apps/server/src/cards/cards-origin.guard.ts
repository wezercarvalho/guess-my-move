import type { IncomingMessage } from 'node:http'
import {
    ForbiddenException,
    Injectable,
    type CanActivate,
    type ExecutionContext,
} from '@nestjs/common'
import { RealtimePolicy } from '../realtime/realtime-policy.service.js'

@Injectable()
export class CardsOriginGuard implements CanActivate {
    constructor(private readonly policy: RealtimePolicy) {}
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<IncomingMessage>()
        if (!this.policy.allowOrigin(request.headers.origin))
            throw new ForbiddenException('Origem não permitida.')
        return true
    }
}
