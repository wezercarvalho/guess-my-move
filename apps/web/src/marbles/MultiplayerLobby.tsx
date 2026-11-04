import { nicknameSchema } from '@guess-my-move/marbles'
import { useState } from 'react'

import { Button } from '../design/index.js'
import { otherPlayer, playerLabel, playerName } from './onlinePresentation.js'
import { type MarblesGameView } from './useMarblesGame.js'

/** Participantes e comandos da sala; o apelido existe só nesta sala, sem conta. */
export function MultiplayerLobby({ game }: { game: MarblesGameView }) {
    const [code, setCode] = useState('')
    const [nickname, setNickname] = useState('')
    const [pending, setPending] = useState(false)
    const [copyMessage, setCopyMessage] = useState('')
    const [localError, setLocalError] = useState('')
    const { room, access, connection, error } = game.multiplayer
    const connected = connection === 'connected'
    const ownReady = access && room?.players[access.role].ready
    const ownRematch = access && room?.players[access.role].rematchReady
    const validNickname = nicknameSchema.safeParse(nickname).success
    const finished = room?.status === 'finished'

    async function command(action: () => Promise<unknown>) {
        setPending(true)
        setLocalError('')
        try {
            await action()
        } catch {
            setLocalError(
                'Não foi possível concluir. Confira a conexão e tente novamente.',
            )
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
    const rival = access ? otherPlayer(access.role) : 'opponent'
    return (
        <section className="marbles-lobby" aria-label="Sala online">
            <div className="marbles-lobby__header">
                <p role="status">
                    {connection === 'connecting'
                        ? 'Conectando…'
                        : connected
                          ? 'Conectado'
                          : 'Sem conexão com o servidor'}
                </p>
                {room && (
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
                    </>
                )}
            </div>
            {(error || localError) && (
                <p role="alert">{error?.message ?? localError}</p>
            )}
            {copyMessage && <p role="status">{copyMessage}</p>}
            {room && access ? (
                <>
                    <ul
                        className="marbles-players"
                        aria-label="Jogadores na sala"
                    >
                        {(['player', 'opponent'] as const).map((role) => {
                            const person = room.players[role]
                            const occupied =
                                person.nickname != null || person.connected
                            const current =
                                room.match?.turn === role &&
                                room.status === 'playing'
                            return (
                                <li
                                    key={role}
                                    className={`marbles-player marbles-player--${role}`}
                                    aria-current={current ? 'true' : undefined}
                                >
                                    <strong>
                                        {occupied
                                            ? playerLabel(
                                                  room,
                                                  role,
                                                  access.role,
                                              )
                                            : 'Vaga disponível'}
                                    </strong>
                                    <span>
                                        {role === 'player'
                                            ? 'Anfitrião'
                                            : 'Convidado'}{' '}
                                        ·{' '}
                                        {person.connected
                                            ? 'Conectado'
                                            : occupied
                                              ? 'Desconectado · aguardando retorno'
                                              : 'Aguardando entrada'}
                                    </span>
                                    <span>
                                        {!room.match
                                            ? person.connected
                                                ? person.ready
                                                    ? 'Pronto'
                                                    : 'Ainda não está pronto'
                                                : ''
                                            : finished
                                              ? person.rematchReady
                                                  ? 'Revanche confirmada'
                                                  : 'Aguardando confirmação da revanche'
                                              : room.status === 'paused'
                                                ? 'Partida pausada'
                                                : current
                                                  ? room.intent ||
                                                    room.match.phase ===
                                                        'rolling'
                                                      ? 'Tiro em andamento'
                                                      : 'Agora'
                                                  : room.nextTurn === role
                                                    ? 'Na sequência'
                                                    : 'Aguardando sua vez'}
                                    </span>
                                    {room.match && (
                                        <span>
                                            Tiros restantes:{' '}
                                            {room.match.shotsLeft[role]}
                                        </span>
                                    )}
                                </li>
                            )
                        })}
                    </ul>
                    {!room.match && (
                        <p>
                            {access.role === 'player'
                                ? 'Você é a pessoa anfitriã.'
                                : 'Você é a pessoa convidada.'}
                        </p>
                    )}
                    {finished && (
                        <p role="status">
                            {ownRematch
                                ? `Você confirmou. Aguardando ${playerName(room, rival)} confirmar para começar.`
                                : room.players[rival].rematchReady
                                  ? `${playerName(room, rival)} quer jogar novamente. Confirme para começar.`
                                  : 'Joguem novamente sem sair: cada pessoa precisa confirmar.'}
                        </p>
                    )}
                    <div className="marbles-lobby__actions">
                        {!room.match && (
                            <Button
                                disabled={
                                    pending ||
                                    !connected ||
                                    room.status === 'paused'
                                }
                                onClick={() => {
                                    void command(() => game.setReady(!ownReady))
                                }}
                            >
                                {ownReady
                                    ? 'Cancelar prontidão'
                                    : 'Estou pronto'}
                            </Button>
                        )}
                        {room.match?.phase === 'match-over' && (
                            <Button
                                disabled={pending || !connected || !finished}
                                onClick={() => {
                                    void command(() =>
                                        game.setRematchReady(!ownRematch),
                                    )
                                }}
                            >
                                {ownRematch
                                    ? 'Cancelar revanche'
                                    : 'Jogar novamente'}
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
                    </div>
                    <p className="marbles-lobby__hint">
                        Sair encerra a sala para os dois jogadores.
                    </p>
                </>
            ) : (
                <>
                    <div className="marbles-nickname">
                        <label htmlFor="marbles-nickname">Seu apelido</label>
                        <input
                            id="marbles-nickname"
                            value={nickname}
                            maxLength={20}
                            autoComplete="off"
                            aria-describedby="marbles-nickname-help"
                            onChange={(event) =>
                                setNickname(event.target.value)
                            }
                        />
                        <small id="marbles-nickname-help">
                            Use um apelido de 2 a 20 caracteres. Visível apenas
                            nesta sala, sem criar conta. Letras, números,
                            espaço, ponto, hífen ou sublinhado.
                        </small>
                    </div>
                    {nickname.length > 0 && !validNickname && (
                        <p role="alert">
                            Apelido inválido. Use de 2 a 20 caracteres
                            permitidos.
                        </p>
                    )}
                    <div className="marbles-lobby__actions">
                        <Button
                            disabled={
                                pending ||
                                connection === 'connecting' ||
                                !validNickname
                            }
                            onClick={() => {
                                void command(() => game.createRoom(nickname))
                            }}
                        >
                            Criar sala
                        </Button>
                        <span>ou entre pelo código</span>
                    </div>
                    <form
                        onSubmit={(event) => {
                            event.preventDefault()
                            if (validNickname && code.trim())
                                void command(() =>
                                    game.joinRoom(code, nickname),
                                )
                        }}
                    >
                        <label htmlFor="marbles-room-code">
                            Código da sala
                        </label>
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
                            disabled={
                                pending ||
                                connection === 'connecting' ||
                                !code.trim() ||
                                !validNickname
                            }
                        >
                            Entrar na sala
                        </Button>
                    </form>
                </>
            )}
        </section>
    )
}
