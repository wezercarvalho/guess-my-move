export interface RateLimiterOptions {
    limit: number
    windowMs: number
    now?: () => number
}

/** Limite simples por conexão; não promete proteção contra abuso distribuído. */
export class SlidingWindowRateLimiter {
    private readonly attempts = new Map<string, number[]>()
    private readonly now: () => number

    constructor(private readonly options: RateLimiterOptions) {
        this.now = options.now ?? Date.now
    }

    accept(key: string): boolean {
        const now = this.now()
        const cutoff = now - this.options.windowMs
        const recent = (this.attempts.get(key) ?? []).filter(
            (time) => time > cutoff,
        )
        if (recent.length >= this.options.limit) {
            this.attempts.set(key, recent)
            return false
        }
        recent.push(now)
        this.attempts.set(key, recent)
        return true
    }

    forget(key: string): void {
        this.attempts.delete(key)
    }
}
