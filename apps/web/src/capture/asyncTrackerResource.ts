export type TrackerResourceStatus = 'idle' | 'loading' | 'ready' | 'error'
interface Closable {
    close(): void
}
interface LoadOptions<T> {
    alive?: () => boolean
    onReady?: (value: T) => void
    onError?: (error: unknown) => void
}
/** Owns one detector; games retain their own gesture and calibration policies. */
export class AsyncTrackerResource<T extends Closable> {
    private instance: T | null = null
    private state: TrackerResourceStatus = 'idle'
    private failure: string | null = null
    private generation = 0
    constructor(
        private readonly messageOf: (error: unknown) => string = (error) =>
            error instanceof Error && error.message
                ? error.message
                : 'Falha desconhecida.',
    ) {}
    get value(): T | null {
        return this.instance
    }
    get status(): TrackerResourceStatus {
        return this.state
    }
    get error(): string | null {
        return this.failure
    }
    load(factory: () => Promise<T>, options: LoadOptions<T> = {}): void {
        if (this.state === 'loading' || this.instance) return
        const generation = ++this.generation
        this.state = 'loading'
        this.failure = null
        const active = () =>
            generation === this.generation && (options.alive?.() ?? true)
        const rejected = (error: unknown) => {
            if (generation !== this.generation) return
            if (!active()) {
                this.state = 'idle'
                return
            }
            this.state = 'error'
            this.failure = this.messageOf(error)
            options.onError?.(error)
        }
        let loading: Promise<T>
        try {
            loading = factory()
        } catch (error) {
            rejected(error)
            return
        }
        void loading.then((value) => {
            if (!active()) {
                value.close()
                if (generation === this.generation) this.state = 'idle'
                return
            }
            this.instance = value
            this.state = 'ready'
            options.onReady?.(value)
        }, rejected)
    }
    release(): void {
        this.generation++
        const value = this.instance
        this.instance = null
        this.state = 'idle'
        this.failure = null
        value?.close()
    }
    fail(error: unknown): void {
        this.release()
        this.state = 'error'
        this.failure = this.messageOf(error)
    }
}
