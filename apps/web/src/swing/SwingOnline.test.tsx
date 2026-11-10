import { StrictMode } from 'react'
import { type ClientSocket } from '../marbles/multiplayerClient.js'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { createSwingState, type SwingRoomState } from '@guess-my-move/swing'
import { describe, expect, it, vi } from 'vitest'
import { SwingOnline } from './SwingOnline.js'
import {
    SwingMultiplayerClient,
    type SwingOnlineSnapshot,
} from './multiplayerClient.js'
vi.mock('./SwingScreen.js', () => ({
    SwingScreen: ({
        onPrepared,
    }: {
        onPrepared?: (ready: boolean) => void
    }) => (
        <div data-testid="online-world">
            Mundo cooperativo
            <button onClick={() => onPrepared?.(true)}>
                Simular confirmação
            </button>
            <button onClick={() => onPrepared?.(false)}>Simular perda</button>
        </div>
    ),
}))
const player = (id: string, nickname: string) => ({
    id,
    nickname,
    connected: true,
    ready: false,
    rematchReady: false,
    state: createSwingState({ x: 0, y: 90, z: 0 }),
})
const room: SwingRoomState = {
    roomCode: 'ABC123',
    cityId: 'aurora',
    cityVersion: 1,
    round: 1,
    tick: 0,
    status: 'waiting',
    players: [player('one', 'Ana'), player('two', 'Bia')],
    objectives: [
        { id: 'light', position: { x: 0, y: 90, z: 0 }, collectedBy: null },
    ],
}
function setup() {
    let snapshot: SwingOnlineSnapshot = {
        connection: 'connected',
        access: null,
        room: null,
        pending: false,
        error: null,
        stale: false,
    }
    const listeners = new Set<() => void>()
    const client = {
        getSnapshot: () => snapshot,
        subscribe: (listener: () => void) => {
            listeners.add(listener)
            return () => {
                listeners.delete(listener)
            }
        },
        connect: vi.fn(),
        destroy: vi.fn(),
        create: vi.fn(),
        join: vi.fn(),
        ready: vi.fn(),
        rematch: vi.fn(),
        leave: vi.fn(),
    }
    const back = vi.fn()
    render(
        <SwingOnline
            catalog={{ version: 1, maps: [] }}
            onBack={back}
            client={client as unknown as SwingMultiplayerClient}
        />,
    )
    return {
        client,
        back,
        update: (value: Partial<SwingOnlineSnapshot>) =>
            act(() => {
                snapshot = { ...snapshot, ...value }
                listeners.forEach((listener) => listener())
            }),
    }
}
describe('Cooperativo Arranha-Teia', () => {
    it('distinguishes a stalled server from disconnection and keeps the world/camera mounted during recovery', () => {
        const game = setup()
        game.update({
            room: { ...room, status: 'playing' },
            access: {
                roomCode: 'ABC123',
                playerId: 'one',
                resumeToken: 'private',
            },
        })
        const world = screen.getByTestId('online-world')
        game.update({ stale: true })
        expect(screen.getByRole('status')).toHaveTextContent(
            'Aguardando atualização do servidor',
        )
        expect(screen.getByTestId('online-world')).toBe(world)
        game.update({
            stale: false,
            room: { ...room, status: 'playing', tick: 3 },
        })
        expect(screen.getByRole('status')).toHaveTextContent('Coletem juntos')
        expect(screen.getByTestId('online-world')).toBe(world)
    })

    it('remains usable after StrictMode repeats the connection effect', async () => {
        const listeners = new Map<string, Set<(...args: unknown[]) => void>>()
        const socket: ClientSocket = {
            connected: true,
            connect() {
                listeners.get('connect')?.forEach((listener) => listener())
            },
            disconnect: vi.fn(),
            on(event, listener) {
                const set = listeners.get(event) ?? new Set()
                set.add(listener)
                listeners.set(event, set)
                return socket
            },
            off(event, listener) {
                listeners.get(event)?.delete(listener)
                return socket
            },
            emit(_event, _payload, ack) {
                ack?.({
                    ok: true,
                    access: {
                        roomCode: 'ABC123',
                        playerId: 'one',
                        resumeToken: 'credential-at-least-32-characters-long',
                    },
                })
                return socket
            },
        }
        const client = new SwingMultiplayerClient(socket)
        render(
            <StrictMode>
                <SwingOnline
                    catalog={{ version: 1, maps: [] }}
                    onBack={vi.fn()}
                    client={client}
                />
            </StrictMode>,
        )
        fireEvent.change(screen.getByLabelText('Seu apelido'), {
            target: { value: 'Ana' },
        })
        expect(screen.getByRole('button', { name: 'Criar sala' })).toBeEnabled()
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Criar sala' }))
            await Promise.resolve()
        })
        expect(client.getSnapshot().access?.roomCode).toBe('ABC123')
        expect(listeners.get('swing:state')?.size).toBe(1)
    })

    it('creates and joins with nickname and code before mounting the world', () => {
        const game = setup()
        fireEvent.change(screen.getByLabelText('Seu apelido'), {
            target: { value: 'Ana' },
        })
        fireEvent.click(screen.getByRole('button', { name: 'Criar sala' }))
        expect(game.client.create).toHaveBeenCalledWith('aurora', 'Ana')
        fireEvent.change(screen.getByLabelText('Código da sala'), {
            target: { value: 'abc123' },
        })
        fireEvent.click(screen.getByRole('button', { name: 'Entrar na sala' }))
        expect(game.client.join).toHaveBeenCalledWith('ABC123', 'Ana')
        expect(screen.queryByTestId('online-world')).not.toBeInTheDocument()
    })
    it('shows both players, readiness, reconnect pause and bilateral rematch in the same room', () => {
        const game = setup()
        game.update({
            room,
            access: {
                roomCode: 'ABC123',
                playerId: 'one',
                resumeToken: 'private',
            },
        })
        expect(screen.getByText(/Ana.*você/)).toBeInTheDocument()
        expect(screen.getByText(/Bia/)).toBeInTheDocument()
        expect(
            screen.getByRole('button', { name: 'Estou pronto' }),
        ).toBeDisabled()
        fireEvent.click(
            screen.getByRole('button', { name: 'Simular confirmação' }),
        )
        expect(game.client.ready).toHaveBeenCalledWith(true)
        expect(screen.getByTestId('online-world')).toBeInTheDocument()
        const lobbyWorld = screen.getByTestId('online-world')
        game.update({ room: { ...room, status: 'playing', tick: 1 } })
        expect(screen.getByTestId('online-world')).toBeInTheDocument()
        game.update({
            connection: 'disconnected',
            room: { ...room, status: 'paused', tick: 2 },
        })
        expect(screen.getByText(/Tentando reconectar/)).toBeInTheDocument()
        expect(screen.getByTestId('online-world')).toBeInTheDocument()
        game.update({
            connection: 'connected',
            room: { ...room, status: 'finished', tick: 3 },
        })
        const world = screen.getByTestId('online-world')
        expect(game.client.rematch).not.toHaveBeenCalled()
        expect(world).toBe(lobbyWorld)
        expect(
            screen.getByRole('button', { name: 'Nova partida' }),
        ).toBeDisabled()
        fireEvent.click(
            screen.getByRole('button', { name: 'Simular confirmação' }),
        )
        expect(game.client.rematch).toHaveBeenCalledOnce()
        expect(
            screen.getByRole('heading', { name: /Sala ABC123/ }),
        ).toBeInTheDocument()
        game.update({ room: { ...room, round: 2, status: 'playing', tick: 0 } })
        expect(screen.getByTestId('online-world')).toBe(world)
        fireEvent.click(
            screen.getByRole('button', { name: 'Sair do cooperativo' }),
        )
        expect(game.client.leave).toHaveBeenCalledOnce()
        expect(game.back).toHaveBeenCalledOnce()
    })
})

it('offers explicit resumption without remounting a world after retries fail', () => {
    const game = setup()
    game.update({
        room: { ...room, status: 'playing' },
        access: { roomCode: 'ABC123', playerId: 'one', resumeToken: 'private' },
    })
    const world = screen.getByTestId('online-world')
    game.update({
        connection: 'disconnected',
        error: 'Retomada não confirmada.',
    })
    fireEvent.click(screen.getByRole('button', { name: 'Tentar retomar' }))
    expect(game.client.connect).toHaveBeenCalledTimes(2)
    expect(screen.getByTestId('online-world')).toBe(world)
})

it('retira prontidão quando a preparação se perde durante a espera', () => {
    const g = setup()
    g.update({
        room,
        access: { roomCode: 'ABC123', playerId: 'one', resumeToken: 'private' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Simular confirmação' }))
    expect(g.client.ready).toHaveBeenLastCalledWith(true)
    g.update({
        room: {
            ...room,
            players: [{ ...room.players[0], ready: true }, room.players[1]],
        },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Simular perda' }))
    expect(g.client.ready).toHaveBeenLastCalledWith(false)
})
