/** Small transport boundary shared by both game clients; no game policy belongs here. */
export interface ClientSocket {
    readonly connected: boolean
    connect(): void
    disconnect(): void
    on(event: string, listener: (...args: unknown[]) => void): this
    off(event: string, listener: (...args: unknown[]) => void): this
    emit(event: string, payload: unknown, ack?: (value: unknown) => void): this
}
