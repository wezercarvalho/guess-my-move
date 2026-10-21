import { vi } from 'vitest'

/** Track falsa que registra se `stop()` foi chamado. */
export interface FakeTrack extends MediaStreamTrack {
    stopped: boolean
}

/** Cria uma `MediaStreamTrack` falsa com `stop()` rastreável. */
export function createFakeTrack(kind: 'video' | 'audio' = 'video'): FakeTrack {
    const track = {
        kind,
        stopped: false,
        stop: vi.fn(function (this: FakeTrack) {
            this.stopped = true
        }),
    }
    return track as unknown as FakeTrack
}

/** Cria uma `MediaStream` falsa com N tracks de vídeo rastreáveis. */
export function createFakeStream(trackCount = 1): {
    stream: MediaStream
    tracks: FakeTrack[]
} {
    const tracks = Array.from({ length: trackCount }, () => createFakeTrack())
    const stream = {
        getTracks: () => tracks,
        getVideoTracks: () => tracks.filter((t) => t.kind === 'video'),
    }
    return { stream: stream as unknown as MediaStream, tracks }
}

/** Erro com `name` definido, imitando os DOMExceptions de getUserMedia. */
export function namedError(name: string, message = name): Error {
    const error = new Error(message)
    error.name = name
    return error
}
