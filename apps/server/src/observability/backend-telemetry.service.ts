import { Inject, Injectable, Optional } from '@nestjs/common'
import { TracerService } from '@nestjs/observe'
import { SWING_CLIENT_EVENTS } from '@guess-my-move/swing'
import { CLIENT_EVENTS } from '@guess-my-move/marbles'

export const HTTP_OPERATIONS = [
    'HealthController:check',
    'ApiController:capabilities',
    'ApiController:multiplayer',
    'ApiController:swing',
    'ApiController:openapi',
    'MetricsController:read',
] as const
export const KNOWN_OPERATIONS: readonly string[] = [
    ...Object.values(CLIENT_EVENTS),
    ...Object.values(SWING_CLIENT_EVENTS),
    ...HTTP_OPERATIONS,
]
export const newCounters = () => ({
    acceptedConnections: 0,
    rejectedConnections: 0,
    rejectedOrigins: 0,
    rateLimited: 0,
    invalidCommands: 0,
    internalErrors: 0,
    telemetryFailures: 0,
    expiredRooms: 0,
    maxTickDelayMs: 0,
})
interface OperationStats {
    count: number
    errors: number
    totalMs: number
    maxMs: number
}

@Injectable()
export class BackendTelemetry {
    readonly counters = newCounters()
    private readonly operations = new Map<string, OperationStats>()

    constructor(
        @Optional()
        @Inject(TracerService)
        private readonly tracer?: Pick<
            TracerService,
            'counter' | 'summary' | 'gauge'
        >,
    ) {}

    record(operation: string, failed: boolean, durationMs: number): void {
        if (!KNOWN_OPERATIONS.includes(operation)) return
        const duration = Number.isFinite(durationMs)
            ? Math.max(0, durationMs)
            : 0
        const stat = this.operations.get(operation) ?? {
            count: 0,
            errors: 0,
            totalMs: 0,
            maxMs: 0,
        }
        stat.count++
        if (failed) stat.errors++
        stat.totalMs += duration
        stat.maxMs = Math.max(stat.maxMs, duration)
        this.operations.set(operation, stat)
        this.publish(() => {
            const name = operation.replaceAll(':', '_').replaceAll('.', '_')
            this.tracer?.counter(`backend_operations_${name}`).increment()
            if (failed)
                this.tracer?.counter(`backend_rejections_${name}`).increment()
            this.tracer
                ?.summary(`backend_duration_ms_${name}`, { sampleSize: 256 })
                .observe(duration)
        })
    }

    private publish(callback: () => void): void {
        try {
            callback()
        } catch {
            this.counters.telemetryFailures++
        }
    }

    snapshot(
        activeConnections: number,
        activeRooms: number,
        activeTransports = 0,
    ) {
        this.publish(() => {
            for (const [name, value] of Object.entries(this.counters))
                this.tracer?.gauge(`backend_${name}`).setValue(value)
            this.tracer
                ?.gauge('backend_active_connections')
                .setValue(activeConnections)
            this.tracer?.gauge('backend_active_rooms').setValue(activeRooms)
        })
        return {
            ...this.counters,
            activeConnections,
            activeTransports,
            activeRooms,
            operations: Object.fromEntries(
                [...this.operations].map(([operation, stats]) => [
                    operation,
                    { ...stats },
                ]),
            ),
        }
    }
}
