import {
    createSwingState,
    SWING_CLIENT_EVENTS as E,
    SWING_SERVER_EVENTS as S,
    type SwingRoomState,
} from '@guess-my-move/swing'
import { describe, expect, it, vi } from 'vitest'
import { type ClientSocket } from '../marbles/multiplayerClient.js'
import { SwingMultiplayerClient } from './multiplayerClient.js'
class Socket implements ClientSocket {
    connected = true
    listeners = new Map<string, Set<(...args: unknown[]) => void>>()
    emitted: Array<{ event: string; payload: unknown }> = []
    connect() {
        this.connected = true
        this.fire('connect')
    }
    disconnect() {
        this.connected = false
    }
    on(event: string, listener: (...args: unknown[]) => void) {
        const listeners = this.listeners.get(event) ?? new Set()
        listeners.add(listener)
        this.listeners.set(event, listeners)
        return this
    }
    off(event: string, listener: (...args: unknown[]) => void) {
        this.listeners.get(event)?.delete(listener)
        return this
    }
    emit(event: string, payload: unknown, ack?: (value: unknown) => void) {
        this.emitted.push({ event, payload })
        ack?.({
            ok: true,
            ...(event === E.create || event === E.resume
                ? {
                      access: {
                          roomCode: 'ABC123',
                          playerId: 'one',
                          resumeToken:
                              'private-credential-with-at-least-32-characters',
                      },
                  }
                : {}),
        })
        return this
    }
    fire(event: string, payload?: unknown) {
        this.listeners.get(event)?.forEach((listener) => listener(payload))
    }
}
function room(tick = 1): SwingRoomState {
    return {
        roomCode: 'ABC123',
        cityId: 'aurora',
        cityVersion: 1,
        round: 1,
        tick,
        status: 'waiting',
        players: [
            {
                id: 'one',
                nickname: 'Ana',
                connected: true,
                ready: false,
                rematchReady: false,
                state: createSwingState({ x: 0, y: 90, z: 0 }),
            },
        ],
        objectives: [],
    }
}
describe('Swing online client', () => {
    it('cancels a command on disconnect and ignores its ACK after a new session starts', async () => {
        vi.useFakeTimers()
        try {
            const socket = new Socket(),
                client = new SwingMultiplayerClient(socket)
            const callbacks: Array<(value: unknown) => void> = []
            socket.emit = (_event, _payload, ack) => {
                if (ack) callbacks.push(ack)
                return socket
            }
            client.connect()
            const first = client.create('aurora', 'Ana')
            socket.fire(S.state, room())
            socket.connected = false
            socket.fire('disconnect')
            expect(client.getSnapshot().pending).toBe(false)
            expect(client.getSnapshot().room).toBeNull()
            expect(vi.getTimerCount()).toBe(0)
            socket.connected = true
            socket.fire('connect')
            const second = client.join('NEW123', 'Ana')
            callbacks[0]({
                ok: true,
                access: {
                    roomCode: 'OLD123',
                    playerId: 'old',
                    resumeToken: 'old-private-credential-32-characters',
                },
            })
            expect(client.getSnapshot().access).toBeNull()
            expect(client.getSnapshot().pending).toBe(true)
            callbacks[1]({
                ok: true,
                access: {
                    roomCode: 'NEW123',
                    playerId: 'new',
                    resumeToken: 'new-private-credential-32-characters',
                },
            })
            expect(await first).toBe(false)
            expect(await second).toBe(true)
            expect(client.getSnapshot().access?.roomCode).toBe('NEW123')
            client.destroy()
        } finally {
            vi.useRealTimers()
        }
    })

    it('ignores a late resume failure from an earlier connection', async () => {
        const socket = new Socket(),
            client = new SwingMultiplayerClient(socket)
        client.connect()
        await client.create('aurora', 'Ana')
        socket.fire(S.state, room())
        const callbacks: Array<(value: unknown) => void> = []
        socket.emit = (_event, _payload, ack) => {
            if (ack) callbacks.push(ack)
            return socket
        }
        socket.fire('disconnect')
        socket.fire('connect')
        socket.fire('disconnect')
        socket.fire('connect')
        callbacks[1]({ ok: true })
        await Promise.resolve()
        callbacks[0]({
            ok: false,
            error: { code: 'expired', message: 'Old failure' },
        })
        await Promise.resolve()
        expect(client.getSnapshot()).toMatchObject({
            connection: 'connected',
            access: { roomCode: 'ABC123' },
            error: null,
        })
        client.destroy()
    })

    it('signals stalled progress, ignores duplicate/older snapshots, and recovers on a new tick', async () => {
        vi.useFakeTimers()
        try {
            const socket = new Socket(),
                client = new SwingMultiplayerClient(socket)
            client.connect()
            await client.create('aurora', 'Ana')
            socket.fire(S.state, { ...room(10), status: 'playing' })
            vi.advanceTimersByTime(1500)
            socket.fire(S.state, { ...room(10), status: 'playing' })
            socket.fire(S.state, { ...room(9), status: 'playing' })
            vi.advanceTimersByTime(500)
            expect(client.getSnapshot()).toMatchObject({
                stale: true,
                connection: 'connected',
                access: { roomCode: 'ABC123' },
            })
            client.sendInput({ held: {}, yawRate: 0, pitchRate: 0 })
            expect(
                socket.emitted.filter((entry) => entry.event === E.input),
            ).toHaveLength(0)
            socket.fire(S.state, { ...room(11), status: 'playing' })
            expect(client.getSnapshot()).toMatchObject({
                stale: false,
                room: { tick: 11 },
            })
            client.sendInput({ held: {}, yawRate: 0, pitchRate: 0 })
            expect(
                socket.emitted.filter((entry) => entry.event === E.input),
            ).toHaveLength(1)
            client.destroy()
            expect(vi.getTimerCount()).toBe(0)
        } finally {
            vi.useRealTimers()
        }
    })

    it('does not show stalled progress in a paused room and clears the watchdog on disconnect/expiration', async () => {
        vi.useFakeTimers()
        try {
            const socket = new Socket(),
                client = new SwingMultiplayerClient(socket)
            client.connect()
            await client.create('aurora', 'Ana')
            socket.fire(S.state, { ...room(), status: 'playing' })
            socket.fire(S.state, { ...room(), status: 'paused' })
            vi.advanceTimersByTime(3000)
            expect(client.getSnapshot()).toMatchObject({
                stale: false,
                room: { status: 'paused' },
            })
            expect(vi.getTimerCount()).toBe(0)
            socket.fire(S.state, { ...room(2), status: 'playing' })
            socket.fire('disconnect')
            expect(vi.getTimerCount()).toBe(0)
            socket.fire('connect')
            await Promise.resolve()
            socket.fire(S.state, { ...room(3), status: 'playing' })
            socket.fire(S.error, { code: 'room-expired', message: 'Expired' })
            expect(vi.getTimerCount()).toBe(0)
            expect(client.getSnapshot()).toMatchObject({
                stale: false,
                access: null,
                room: null,
            })
            client.destroy()
        } finally {
            vi.useRealTimers()
        }
    })

    it('supports StrictMode setup cleanup setup on the same instance without duplicate listeners', async () => {
        const socket = new Socket(),
            client = new SwingMultiplayerClient(socket)
        client.connect()
        client.destroy()
        client.connect()
        expect(client.getSnapshot().connection).toBe('connected')
        expect(socket.listeners.get(S.state)?.size).toBe(1)
        await client.create('aurora', 'Ana')
        socket.fire(S.state, room())
        expect(client.getSnapshot().room?.roomCode).toBe('ABC123')
        client.destroy()
        expect(socket.listeners.get(S.state)?.size).toBe(0)
    })

    it('returns to room creation after expiration and never attempts to resume an expired room', async () => {
        const socket = new Socket(),
            client = new SwingMultiplayerClient(socket)
        client.connect()
        await client.create('aurora', 'Ana')
        socket.fire(S.state, room())
        socket.fire(S.error, {
            code: 'room-expired',
            message: 'A sala expirou. Crie uma nova sala.',
        })
        expect(client.getSnapshot()).toMatchObject({
            room: null,
            access: null,
            pending: false,
            error: 'A sala expirou. Crie uma nova sala.',
        })
        socket.fire('disconnect')
        socket.fire('connect')
        await Promise.resolve()
        expect(socket.emitted.some((entry) => entry.event === E.resume)).toBe(
            false,
        )
        client.destroy()
    })

    it('cleans pending acknowledgement timers and ignores delayed acknowledgements after leaving', async () => {
        vi.useFakeTimers()
        try {
            const socket = new Socket(),
                client = new SwingMultiplayerClient(socket)
            let delayed: ((value: unknown) => void) | undefined
            socket.emit = (_event, _payload, ack) => {
                delayed = ack
                return socket
            }
            client.connect()
            const pending = client.create('aurora', 'Ana')
            expect(vi.getTimerCount()).toBe(1)
            client.leave()
            expect(await pending).toBe(false)
            expect(vi.getTimerCount()).toBe(0)
            delayed?.({
                ok: true,
                access: {
                    roomCode: 'ABC123',
                    playerId: 'one',
                    resumeToken:
                        'private-credential-with-at-least-32-characters',
                },
            })
            expect(client.getSnapshot().access).toBeNull()
            client.destroy()
        } finally {
            vi.useRealTimers()
        }
    })

    it('rejects stale snapshots and other rooms, and retains credentials only in memory', async () => {
        const socket = new Socket(),
            client = new SwingMultiplayerClient(socket)
        client.connect()
        await client.create('aurora', 'Ana')
        socket.fire(S.state, room(10))
        socket.fire(S.state, room(9))
        socket.fire(S.state, { ...room(20), roomCode: 'OTHER1' })
        expect(client.getSnapshot().room?.tick).toBe(10)
        expect(JSON.stringify(client.getSnapshot().room)).not.toContain(
            'private-credential',
        )
        client.destroy()
        expect(client.getSnapshot().access).toBeNull()
    })
    it('resumes automatically and explicit leave prevents later resumption', async () => {
        const socket = new Socket(),
            client = new SwingMultiplayerClient(socket)
        client.connect()
        await client.create('aurora', 'Ana')
        socket.fire(S.state, room(3))
        socket.fire('disconnect')
        socket.fire('connect')
        await Promise.resolve()
        expect(socket.emitted.some((entry) => entry.event === E.resume)).toBe(
            true,
        )
        client.leave()
        socket.fire('connect')
        await Promise.resolve()
        expect(client.getSnapshot().access).toBeNull()
        expect(client.getSnapshot().room).toBeNull()
        expect(
            socket.emitted.filter((entry) => entry.event === E.resume),
        ).toHaveLength(1)
        client.destroy()
    })
    it('sends only intent during playing, preserves round and sequence, and rematches in place', async () => {
        const socket = new Socket(),
            client = new SwingMultiplayerClient(socket)
        client.connect()
        await client.create('aurora', 'Ana')
        socket.fire(S.state, { ...room(), status: 'playing' })
        client.sendInput({ held: { center: true }, yawRate: 1, pitchRate: 0 })
        expect(socket.emitted.at(-1)).toEqual({
            event: E.input,
            payload: {
                round: 1,
                seq: 1,
                input: { held: { center: true }, yawRate: 1, pitchRate: 0 },
            },
        })
        socket.fire(S.state, { ...room(2), status: 'paused' })
        client.sendInput({ held: {}, yawRate: 0, pitchRate: 0 })
        expect(
            socket.emitted.filter((entry) => entry.event === E.input),
        ).toHaveLength(1)
        socket.fire(S.state, { ...room(3), status: 'finished' })
        await client.rematch()
        expect(socket.emitted.at(-1)).toEqual({
            event: E.rematch,
            payload: { round: 1 },
        })
        expect(client.getSnapshot().access?.roomCode).toBe('ABC123')
        client.destroy()
    })
})

it('recovers private membership when create ACK is lost after a provisional snapshot', async () => {
    vi.useFakeTimers()
    const socket = new Socket(),
        client = new SwingMultiplayerClient(socket)
    const original = socket.emit.bind(socket)
    socket.emit = (event, payload, ack) => {
        if (event === E.create) {
            socket.fire(S.state, room())
            return socket
        }
        if (event === 'swing:recover') return original(E.resume, payload, ack)
        return original(event, payload, ack)
    }
    try {
        client.connect()
        const creation = client.create('aurora', 'Ana')
        await vi.advanceTimersByTimeAsync(5000)
        expect(await creation).toBe(true)
        expect(client.getSnapshot()).toMatchObject({
            pending: false,
            access: { playerId: 'one' },
            room: { roomCode: 'ABC123' },
        })
    } finally {
        client.destroy()
        vi.useRealTimers()
    }
})
it('retains resume credentials and retries a lost ACK on the same connection', async () => {
    vi.useFakeTimers()
    const socket = new Socket(),
        client = new SwingMultiplayerClient(socket)
    try {
        client.connect()
        await client.create('aurora', 'Ana')
        socket.fire(S.state, room())
        const original = socket.emit.bind(socket)
        let attempts = 0
        socket.emit = (event, payload, ack) =>
            event === E.resume && ++attempts === 1
                ? socket
                : original(event, payload, ack)
        socket.connected = false
        socket.fire('disconnect')
        socket.connected = true
        socket.fire('connect')
        await vi.advanceTimersByTimeAsync(5000)
        expect(client.getSnapshot().access?.playerId).toBe('one')
        expect(client.getSnapshot().connection).toBe('connecting')
        await vi.advanceTimersByTimeAsync(500)
        expect(attempts).toBe(2)
        expect(client.getSnapshot().connection).toBe('connected')
    } finally {
        client.destroy()
        vi.useRealTimers()
    }
})
it('clears provisional membership after a definitive recovery refusal', async () => {
    vi.useFakeTimers()
    const socket = new Socket(),
        client = new SwingMultiplayerClient(socket)
    socket.emit = (event, _payload, ack) => {
        if (event === 'swing:recover')
            ack?.({
                ok: false,
                error: { code: 'not-in-room', message: 'Entre primeiro.' },
            })
        return socket
    }
    try {
        client.connect()
        const result = client.join('ABC123', 'Ana')
        socket.fire(S.state, room())
        await vi.advanceTimersByTimeAsync(5000)
        expect(await result).toBe(false)
        expect(client.getSnapshot()).toMatchObject({
            pending: false,
            room: null,
            access: null,
        })
        expect(vi.getTimerCount()).toBe(0)
    } finally {
        client.destroy()
        vi.useRealTimers()
    }
})
it('cancels recovery retry waits when destroyed', async () => {
    vi.useFakeTimers()
    const socket = new Socket(),
        client = new SwingMultiplayerClient(socket)
    socket.emit = () => socket
    try {
        client.connect()
        const result = client.create('aurora', 'Ana')
        await vi.advanceTimersByTimeAsync(10000)
        client.destroy()
        expect(await result).toBe(false)
        expect(vi.getTimerCount()).toBe(0)
    } finally {
        client.destroy()
        vi.useRealTimers()
    }
})

it('returns to an interactive lobby after bounded recovery attempts and permits an explicit resume retry', async () => {
    vi.useFakeTimers()
    const socket = new Socket(),
        client = new SwingMultiplayerClient(socket)
    const original = socket.emit.bind(socket)
    let recoveries = 0
    socket.emit = (event) => {
        if (event === 'swing:recover') recoveries++
        return socket
    }
    try {
        client.connect()
        const created = client.create('aurora', 'Ana')
        socket.fire(S.state, room())
        await vi.advanceTimersByTimeAsync(21000)
        expect(await created).toBe(false)
        expect(recoveries).toBe(3)
        expect(client.getSnapshot()).toMatchObject({
            connection: 'connected',
            pending: false,
            room: null,
            access: null,
        })
        socket.emit = original
        expect(await client.create('aurora', 'Ana')).toBe(true)
        socket.connected = false
        socket.fire('disconnect')
        socket.connected = true
        socket.emit = () => socket
        socket.fire('connect')
        await vi.advanceTimersByTimeAsync(16000)
        expect(client.getSnapshot()).toMatchObject({
            connection: 'disconnected',
            access: { playerId: 'one' },
        })
        socket.emit = original
        client.connect()
        await vi.advanceTimersByTimeAsync(0)
        expect(client.getSnapshot().connection).toBe('connected')
    } finally {
        client.destroy()
        vi.useRealTimers()
    }
})
