import { isIP } from 'node:net'
import type { ServerConfig } from '../server-config.js'

const normalizeIp = (value: string) =>
    value.startsWith('::ffff:') && isIP(value.slice(7)) === 4
        ? value.slice(7)
        : value

/** Só percorre X-Forwarded-For quando o peer imediato e cada proxy são confiáveis. */
export function clientAddress(
    peer: string,
    forwarded: string | string[] | undefined,
    trusted: readonly string[],
): string {
    let current = normalizeIp(peer)
    const proxies = new Set(trusted.map(normalizeIp))
    if (
        !proxies.has(current) ||
        typeof forwarded !== 'string' ||
        forwarded.length > 2048
    )
        return current
    const chain = forwarded.split(',').map((part) => normalizeIp(part.trim()))
    if (chain.length > 16 || chain.some((part) => isIP(part) === 0))
        return current
    for (const address of chain.reverse()) {
        if (!proxies.has(current)) break
        current = address
    }
    return current
}

export function isAllowedOrigin(
    origin: string | undefined,
    config: Pick<ServerConfig, 'allowOriginless' | 'allowedOrigins'>,
): boolean {
    return origin === undefined
        ? config.allowOriginless
        : config.allowedOrigins.includes(origin)
}

/** Contadores em memória, com teto de conexões e de chaves do orçamento agregado. */
export class ConnectionAdmission {
    private readonly connections = new Map<string, string>()
    private readonly perAddress = new Map<string, number>()
    private readonly attempts = new Map<
        string,
        { count: number; expiresAt: number }
    >()
    private nextSweep = 0

    constructor(
        private readonly config: Pick<
            ServerConfig,
            | 'maxConnections'
            | 'maxConnectionsPerIp'
            | 'roomAttemptsPerMinute'
            | 'maxTrackedAddresses'
        >,
        private readonly now: () => number = Date.now,
    ) {}

    connect(id: string, address: string): boolean {
        if (this.connections.has(id)) return true
        const count = this.perAddress.get(address) ?? 0
        if (
            this.connections.size >= this.config.maxConnections ||
            count >= this.config.maxConnectionsPerIp
        )
            return false
        this.connections.set(id, address)
        this.perAddress.set(address, count + 1)
        return true
    }

    disconnect(id: string): void {
        const address = this.connections.get(id)
        if (address === undefined) return
        this.connections.delete(id)
        const count = (this.perAddress.get(address) ?? 1) - 1
        if (count > 0) this.perAddress.set(address, count)
        else this.perAddress.delete(address)
    }

    acceptRoomAttempt(address: string): boolean {
        const now = this.now()
        if (now >= this.nextSweep) {
            for (const [key, value] of this.attempts)
                if (value.expiresAt <= now) this.attempts.delete(key)
            this.nextSweep = now + 10_000
        }
        let entry = this.attempts.get(address)
        if (entry && entry.expiresAt <= now) {
            this.attempts.delete(address)
            entry = undefined
        }
        if (!entry) {
            if (this.attempts.size >= this.config.maxTrackedAddresses)
                return false
            entry = { count: 0, expiresAt: now + 60_000 }
            this.attempts.set(address, entry)
        }
        if (entry.count >= this.config.roomAttemptsPerMinute) return false
        entry.count++
        return true
    }

    get activeConnections(): number {
        return this.connections.size
    }
}
