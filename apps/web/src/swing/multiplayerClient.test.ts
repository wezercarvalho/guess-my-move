import { createSwingState, SWING_CLIENT_EVENTS as E, SWING_SERVER_EVENTS as S, type SwingRoomState } from '@guess-my-move/swing'
import { describe, expect, it, vi } from 'vitest'
import { type ClientSocket } from '../marbles/multiplayerClient.js'
import { SwingMultiplayerClient } from './multiplayerClient.js'
class Socket implements ClientSocket {
    connected = true
    listeners = new Map<string, Set<(...args: unknown[]) => void>>()
    emitted: Array<{ event: string; payload: unknown }> = []
    connect() { this.connected = true; this.fire('connect') }
    disconnect() { this.connected = false }
    on(event: string, listener: (...args: unknown[]) => void) { const listeners = this.listeners.get(event) ?? new Set(); listeners.add(listener); this.listeners.set(event, listeners); return this }
    off(event: string, listener: (...args: unknown[]) => void) { this.listeners.get(event)?.delete(listener); return this }
    emit(event: string, payload: unknown, ack?: (value: unknown) => void) { this.emitted.push({ event, payload }); ack?.({ ok: true, ...(event === E.create || event === E.resume ? { access: { roomCode: 'ABC123', playerId: 'one', resumeToken: 'private-credential-with-at-least-32-characters' } } : {}) }); return this }
    fire(event: string, payload?: unknown) { this.listeners.get(event)?.forEach((listener) => listener(payload)) }
}
function room(tick = 1): SwingRoomState { return { roomCode: 'ABC123', cityId: 'aurora', cityVersion: 1, round: 1, tick, status: 'waiting', players: [{ id: 'one', nickname: 'Ana', connected: true, ready: false, rematchReady: false, state: createSwingState({ x: 0, y: 90, z: 0 }) }], objectives: [] } }
describe('Swing online client', () => {
    it('supports StrictMode setup cleanup setup on the same instance without duplicate listeners', async () => {
        const socket = new Socket(), client = new SwingMultiplayerClient(socket)
        client.connect(); client.destroy(); client.connect()
        expect(client.getSnapshot().connection).toBe('connected')
        expect(socket.listeners.get(S.state)?.size).toBe(1)
        await client.create('aurora', 'Ana'); socket.fire(S.state, room())
        expect(client.getSnapshot().room?.roomCode).toBe('ABC123')
        client.destroy(); expect(socket.listeners.get(S.state)?.size).toBe(0)
    })

    it('returns to room creation after expiration and never attempts to resume an expired room', async () => {
        const socket = new Socket(), client = new SwingMultiplayerClient(socket)
        client.connect(); await client.create('aurora', 'Ana'); socket.fire(S.state, room())
        socket.fire(S.error, { code: 'room-expired', message: 'A sala expirou. Crie uma nova sala.' })
        expect(client.getSnapshot()).toMatchObject({ room: null, access: null, pending: false, error: 'A sala expirou. Crie uma nova sala.' })
        socket.fire('disconnect'); socket.fire('connect'); await Promise.resolve()
        expect(socket.emitted.some((entry) => entry.event === E.resume)).toBe(false)
        client.destroy()
    })

    it('cleans pending acknowledgement timers and ignores delayed acknowledgements after leaving', async () => {
        vi.useFakeTimers()
        try {
            const socket = new Socket(), client = new SwingMultiplayerClient(socket)
            let delayed: ((value: unknown) => void) | undefined
            socket.emit = (_event, _payload, ack) => { delayed = ack; return socket }
            client.connect()
            const pending = client.create('aurora', 'Ana')
            expect(vi.getTimerCount()).toBe(1)
            client.leave()
            expect(await pending).toBe(false)
            expect(vi.getTimerCount()).toBe(0)
            delayed?.({ ok: true, access: { roomCode: 'ABC123', playerId: 'one', resumeToken: 'private-credential-with-at-least-32-characters' } })
            expect(client.getSnapshot().access).toBeNull()
            client.destroy()
        } finally { vi.useRealTimers() }
    })

    it('rejects stale snapshots and other rooms, and retains credentials only in memory', async () => {
        const socket = new Socket(), client = new SwingMultiplayerClient(socket)
        client.connect(); await client.create('aurora', 'Ana')
        socket.fire(S.state, room(10)); socket.fire(S.state, room(9)); socket.fire(S.state, { ...room(20), roomCode: 'OTHER1' })
        expect(client.getSnapshot().room?.tick).toBe(10)
        expect(JSON.stringify(client.getSnapshot().room)).not.toContain('private-credential')
        client.destroy(); expect(client.getSnapshot().access).toBeNull()
    })
    it('resumes automatically and explicit leave prevents later resumption', async () => {
        const socket = new Socket(), client = new SwingMultiplayerClient(socket)
        client.connect(); await client.create('aurora', 'Ana')
        socket.fire(S.state, room(3)); socket.fire('disconnect'); socket.fire('connect'); await Promise.resolve()
        expect(socket.emitted.some((entry) => entry.event === E.resume)).toBe(true)
        client.leave(); socket.fire('connect'); await Promise.resolve()
        expect(client.getSnapshot().access).toBeNull(); expect(client.getSnapshot().room).toBeNull()
        expect(socket.emitted.filter((entry) => entry.event === E.resume)).toHaveLength(1); client.destroy()
    })
    it('sends only intent during playing, preserves round and sequence, and rematches in place', async () => {
        const socket = new Socket(), client = new SwingMultiplayerClient(socket)
        client.connect(); await client.create('aurora', 'Ana'); socket.fire(S.state, { ...room(), status: 'playing' })
        client.sendInput({ held: { center: true }, yawRate: 1, pitchRate: 0 })
        expect(socket.emitted.at(-1)).toEqual({ event: E.input, payload: { round: 1, seq: 1, input: { held: { center: true }, yawRate: 1, pitchRate: 0 } } })
        socket.fire(S.state, { ...room(2), status: 'paused' }); client.sendInput({ held: {}, yawRate: 0, pitchRate: 0 })
        expect(socket.emitted.filter((entry) => entry.event === E.input)).toHaveLength(1)
        socket.fire(S.state, { ...room(3), status: 'finished' }); await client.rematch()
        expect(socket.emitted.at(-1)).toEqual({ event: E.rematch, payload: { round: 1 } }); expect(client.getSnapshot().access?.roomCode).toBe('ABC123'); client.destroy()
    })
})
