import { CLIENT_EVENTS, SERVER_EVENTS } from '@guess-my-move/marbles'
import { describe, expect, it, vi } from 'vitest'

import { MultiplayerGateway } from '../src/multiplayer/multiplayer.gateway.js'
import { RoomService } from '../src/multiplayer/room.service.js'

type Client = Parameters<MultiplayerGateway['handleCreate']>[0]

function harness() {
    const emits: { event: string; payload: unknown }[] = []
    const join = vi.fn()
    const client = { id: 'socket-1', join, emit: vi.fn() } as unknown as Client
    const rooms = new RoomService({
        code: () => 'ABCDEF',
        token: () => 'a'.repeat(32),
    })
    const gateway = new MultiplayerGateway(rooms, { tickMs: 33 })
    gateway.server = {
        to: vi.fn(() => ({
            emit: (event: string, payload: unknown) => {
                emits.push({ event, payload })
            },
        })),
        in: vi.fn(() => ({
            emit: (event: string, payload: unknown) => {
                emits.push({ event, payload })
            },
            socketsLeave: vi.fn(),
        })),
    } as never
    return { gateway, client, join, emits }
}

describe('MultiplayerGateway', () => {
    it('cria a sala, associa o socket, confirma o acesso e publica o estado', async () => {
        const h = harness()
        const ack = await h.gateway.handleCreate(h.client, { modeId: 'bete' })
        expect(ack).toMatchObject({
            ok: true,
            access: { roomCode: 'ABCDEF', role: 'player' },
        })
        expect(h.join).toHaveBeenCalledWith('ABCDEF')
        const published = h.emits.find(({ event }) => event === SERVER_EVENTS.state)
        expect(published?.payload).toMatchObject({ roomCode: 'ABCDEF', version: 0 })
    })

    it('normaliza código na entrada e retorna erro estável para payload inválido', async () => {
        const h = harness()
        await h.gateway.handleCreate(h.client, { modeId: 'bete' })
        const secondEmit = vi.fn()
        const second = { id: 'socket-2', join: vi.fn(), emit: secondEmit } as unknown as Client
        const joined = await h.gateway.handleJoin(second, { roomCode: ' ab cd ef ' })
        expect(joined).toMatchObject({ ok: true, access: { role: 'opponent' } })

        const invalid = await h.gateway.handleReady(second, { ready: true, landmarks: [] })
        expect(invalid).toEqual({
            ok: false,
            error: { code: 'INVALID_PAYLOAD', message: 'Comando inválido.' },
        })
        if (invalid.ok) throw new Error('esperava acknowledgement de erro')
        expect(secondEmit).toHaveBeenCalledWith(SERVER_EVENTS.error, invalid.error)
    })

    it('usa somente os eventos declarados no protocolo compartilhado', () => {
        expect(CLIENT_EVENTS.create).toBe('room:create')
        expect(SERVER_EVENTS.state).toBe('room:state')
    })

    it('limita o socket que excede comandos sem derrubar o gateway', async () => {
        const h = harness()
        await h.gateway.handleCreate(h.client, { modeId: 'bete' })
        for (let i = 0; i < 19; i++) {
            expect((await h.gateway.handleReady(h.client, { ready: i % 2 === 0 })).ok).toBe(true)
        }
        const blocked = await h.gateway.handleReady(h.client, { ready: true })
        expect(blocked).toEqual({
            ok: false,
            error: { code: 'RATE_LIMITED', message: 'Muitos comandos. Aguarde um instante.' },
        })
    })
})
