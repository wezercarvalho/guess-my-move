import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
    createMatchSession,
    modes,
    wireMatchSnapshotSchema,
    type RoomState,
} from '@guess-my-move/marbles'
import { MultiplayerLobby } from './MultiplayerLobby.js'
import { type MarblesGameView } from './useMarblesGame.js'

function view(
    room: RoomState | null = null,
    role: 'player' | 'opponent' = 'player',
) {
    return {
        multiplayer: {
            connection: 'connected',
            room,
            access: room
                ? { roomCode: room.roomCode, role, resumeToken: 'a'.repeat(32) }
                : null,
            error: null,
        },
        createRoom: vi.fn(() => Promise.resolve(true)),
        joinRoom: vi.fn(() => Promise.resolve(true)),
        setReady: vi.fn(() => Promise.resolve(true)),
        setRematchReady: vi.fn(() => Promise.resolve(true)),
        leaveRoom: vi.fn(() => Promise.resolve()),
    } as unknown as MarblesGameView
}
const room: RoomState = {
    roomCode: 'ABCDEF',
    modeId: 'bete',
    status: 'ready',
    version: 2,
    matchNumber: 1,
    nextTurn: null,
    players: {
        player: { connected: true, ready: true, nickname: 'Ana' },
        opponent: { connected: true, ready: false, nickname: 'Bia' },
    },
    match: null,
    intent: null,
    reconnectDeadlineMs: null,
}

describe('MultiplayerLobby: compreensão da sala', () => {
    it('pede apelido e o envia junto da criação', () => {
        const game = view()
        render(<MultiplayerLobby game={game} />)
        expect(
            screen.getByRole('button', { name: 'Criar sala' }),
        ).toBeDisabled()
        fireEvent.change(screen.getByLabelText('Seu apelido'), {
            target: { value: 'Lia' },
        })
        fireEvent.click(screen.getByRole('button', { name: 'Criar sala' }))
        expect(game.createRoom).toHaveBeenCalledWith('Lia')
    })
    it('mostra nomes, marca local e prontidão por vaga', () => {
        render(<MultiplayerLobby game={view(room, 'opponent')} />)
        const roster = screen.getByRole('list', { name: 'Jogadores na sala' })
        expect(within(roster).getByText('Ana')).toBeInTheDocument()
        expect(within(roster).getByText('Bia (Você)')).toBeInTheDocument()
        expect(roster).toHaveTextContent('Pronto')
        expect(roster).toHaveTextContent('Ainda não está pronto')
    })
    it('informa quem ainda precisa aceitar a revanche', () => {
        const { playerShotsLeft: _legacy, ...wire } = createMatchSession({
            modeId: 'bete',
            mode: modes[0].create(),
            opponent: 'remote',
        }).snapshot()
        const final = {
            ...room,
            status: 'finished' as const,
            match: wireMatchSnapshotSchema.parse({
                ...wire,
                phase: 'match-over',
            }),
            players: {
                ...room.players,
                player: { ...room.players.player, rematchReady: true },
            },
        }
        const game = view(final, 'opponent')
        render(<MultiplayerLobby game={game} />)
        expect(screen.getByText(/Ana quer jogar novamente/)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Jogar novamente' }))
        expect(game.setRematchReady).toHaveBeenCalledWith(true)
    })
})
