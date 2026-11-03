import { useState } from 'react'

import { Button } from '../design/index.js'
import { type MarblesGameView } from './useMarblesGame.js'

/** Sala e comandos de conexão, sem dados da câmera. */
export function MultiplayerLobby({ game }: { game: MarblesGameView }) {
    const [code, setCode] = useState('')
    const [pending, setPending] = useState(false)
    const [copyMessage, setCopyMessage] = useState('')
    const { room, access, connection, error } = game.multiplayer
    const connected = connection === 'connected'
    const ownReady = access && room?.players[access.role].ready

    async function command(action: () => Promise<unknown>) {
        setPending(true)
        try {
            await action()
        } finally {
            setPending(false)
        }
    }

    async function copyCode() {
        if (!room) return
        try {
            await navigator.clipboard.writeText(room.roomCode)
            setCopyMessage('Código copiado.')
        } catch {
            setCopyMessage('Selecione o código acima para copiar.')
        }
    }

    return (
        <div className="marbles-lobby" aria-label="Sala online">
            <p role="status">
                {connection === 'connecting'
                    ? 'Conectando…'
                    : connected
                      ? 'Conectado'
                      : 'Sem conexão com o servidor'}
            </p>
            {error && <p role="alert">{error.message}</p>}
            {room && access ? (
                <>
                    <p>
                        Código da sala: <strong>{room.roomCode}</strong>
                    </p>
                    <Button
                        variant="secondary"
                        onClick={() => {
                            void copyCode()
                        }}
                    >
                        Copiar código
                    </Button>
                    <p aria-live="polite">{copyMessage}</p>
                    {!room.match && (
                        <p>
                            {access.role === 'player'
                                ? 'Você é a pessoa anfitriã.'
                                : 'Você é a pessoa convidada.'}
                        </p>
                    )}
                    <p>
                        {room.players.player.connected && room.players.opponent.connected
                            ? 'Duas pessoas conectadas.'
                            : 'Aguardando outra pessoa…'}
                    </p>
                    {!room.match && (
                        <p>
                            Você: {ownReady ? 'pronto' : 'não pronto'} · Outra pessoa:{' '}
                            {room.players[access.role === 'player' ? 'opponent' : 'player'].ready
                                ? 'pronto'
                                : 'não pronto'}
                        </p>
                    )}
                    {!room.match && (
                        <Button
                            disabled={pending || !connected || room.status === 'paused'}
                            onClick={() => {
                                void command(() => game.setReady(!ownReady))
                            }}
                        >
                            {ownReady ? 'Cancelar prontidão' : 'Estou pronto'}
                        </Button>
                    )}
                    <Button
                        variant="secondary"
                        disabled={pending}
                        onClick={() => {
                            void command(game.leaveRoom)
                        }}
                    >
                        Sair da sala
                    </Button>
                </>
            ) : (
                <>
                    <Button
                        disabled={pending || connection === 'connecting'}
                        onClick={() => {
                            void command(game.createRoom)
                        }}
                    >
                        Criar sala
                    </Button>
                    <form
                        onSubmit={(event) => {
                            event.preventDefault()
                            void command(() => game.joinRoom(code))
                        }}
                    >
                        <label htmlFor="marbles-room-code">Código da sala</label>
                        <input
                            id="marbles-room-code"
                            value={code}
                            autoComplete="off"
                            autoCapitalize="characters"
                            maxLength={20}
                            onChange={(event) => setCode(event.target.value)}
                        />
                        <Button
                            type="submit"
                            disabled={pending || connection === 'connecting' || !code.trim()}
                        >
                            Entrar na sala
                        </Button>
                    </form>
                </>
            )}
        </div>
    )
}
