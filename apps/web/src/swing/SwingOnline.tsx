import { useEffect, useState, useSyncExternalStore } from 'react'
import { Button, Panel } from '../design/index.js'
import { type CityCatalog } from './cityCatalog.js'
import { TRAINING_MAP } from './training.js'
import { SwingScreen } from './SwingScreen.js'
import { SwingMultiplayerClient } from './multiplayerClient.js'
import { type SwingDeps } from './useSwingGame.js'

export function SwingOnline({
    catalog,
    onBack,
    deps,
    client: injected,
}: {
    catalog: CityCatalog
    onBack: () => void
    deps?: SwingDeps
    client?: SwingMultiplayerClient
}) {
    const [client] = useState(() => injected ?? new SwingMultiplayerClient())
    const view = useSyncExternalStore(client.subscribe, client.getSnapshot)
    const [nickname, setNickname] = useState('')
    const [code, setCode] = useState('')
    const [city, setCity] = useState(TRAINING_MAP.id)
    useEffect(() => {
        client.connect()
        return () => client.destroy()
    }, [client])
    const room = view.room
    const me = room?.players.find(
        (player) => player.id === view.access?.playerId,
    )
    const maps = [
        TRAINING_MAP,
        ...catalog.maps.filter((map) => map.id !== TRAINING_MAP.id),
    ]
    const map = maps.find((candidate) => candidate.id === room?.cityId)
    const connected = view.connection === 'connected'
    const busy = view.pending || !connected || view.stale
    const exit = () => {
        client.leave()
        onBack()
    }
    const status =
        view.connection === 'connecting'
            ? 'Conectando à sala…'
            : !connected
              ? 'Conexão interrompida. Tentando reconectar à mesma sala…'
              : view.stale
                ? 'Aguardando atualização do servidor. A partida será retomada automaticamente.'
                : room?.status === 'paused'
                  ? 'Partida pausada. Aguardando a outra pessoa reconectar.'
                  : room?.status === 'finished'
                    ? 'Objetivos concluídos! Confirmem uma nova partida para continuar na mesma sala.'
                    : room?.status === 'playing'
                      ? 'Coletem juntos os sinais luminosos pela cidade.'
                      : 'A partida começa quando as duas pessoas estiverem prontas.'
    const feedback = (
        <Panel
            raised
            aria-label="Sala cooperativa"
            className="swing-online-feedback"
        >
            <h2 className="swing-online-feedback__title">
                Cooperativo online{room ? ` · Sala ${room.roomCode}` : ''}
            </h2>
            <p
                className="swing-online-feedback__status"
                role="status"
                aria-live="polite"
            >
                {room || !connected
                    ? status
                    : 'Conectado. Crie ou entre em uma sala.'}
            </p>
            {view.error ? (
                <p className="swing-online-feedback__error" role="alert">
                    {view.error}
                </p>
            ) : null}
            {view.connection === 'disconnected' && view.access ? (
                <Button onClick={() => client.connect()}>Tentar retomar</Button>
            ) : null}
            {room ? (
                <>
                    <ul className="swing-online-feedback__players">
                        {room.players.map((player, index) => (
                            <li key={player.id}>
                                <span
                                    style={{
                                        color:
                                            index === 0 ? '#00d5ff' : '#ffb84d',
                                    }}
                                >
                                    ●
                                </span>{' '}
                                {player.nickname}
                                {player.id === me?.id ? ' (você)' : ''} ·{' '}
                                {!player.connected
                                    ? 'desconectado'
                                    : room.status === 'finished'
                                      ? player.rematchReady
                                          ? 'nova partida confirmada'
                                          : 'aguardando confirmação'
                                      : player.ready
                                        ? 'pronto'
                                        : 'preparando'}
                            </li>
                        ))}
                    </ul>
                    {room.players.length < 2 ? (
                        <p className="swing-online-feedback__hint">
                            Aguardando a segunda pessoa. Compartilhe o código da
                            sala.
                        </p>
                    ) : null}
                    <p className="swing-online-feedback__progress">
                        Objetivos:{' '}
                        {
                            room.objectives.filter(
                                (objective) => objective.collectedBy !== null,
                            ).length
                        }
                        /{room.objectives.length}
                    </p>
                    {room.status === 'waiting' ? (
                        <Button
                            disabled={busy || !me}
                            onClick={() => {
                                void client.ready(!me?.ready)
                            }}
                        >
                            {me?.ready
                                ? 'Ainda não estou pronto'
                                : 'Estou pronto'}
                        </Button>
                    ) : null}
                    {room.status === 'finished' ? (
                        <Button
                            disabled={busy || !!me?.rematchReady}
                            onClick={() => {
                                void client.rematch()
                            }}
                        >
                            {me?.rematchReady
                                ? 'Aguardando outra confirmação'
                                : 'Nova partida'}
                        </Button>
                    ) : null}
                </>
            ) : null}
            <Button
                className="swing-online-feedback__leave"
                variant="text"
                onClick={exit}
            >
                Sair do cooperativo
            </Button>
        </Panel>
    )
    if (room && room.status !== 'waiting' && view.access && map)
        return (
            <main className="app app-wide app-fill swing-online-session">
                {feedback}
                <SwingScreen
                    key={room.roomCode}
                    map={map}
                    online={client}
                    {...(deps ? { deps } : {})}
                />
            </main>
        )
    return (
        <main className="app app-wide swing-online-lobby">
            {feedback}
            {!room ? (
                <Panel raised>
                    <label>
                        Seu apelido
                        <input
                            value={nickname}
                            onChange={(event) =>
                                setNickname(event.target.value)
                            }
                            minLength={2}
                            maxLength={20}
                            autoComplete="off"
                        />
                    </label>
                    <form
                        onSubmit={(event) => {
                            event.preventDefault()
                            void client.create(city, nickname)
                        }}
                    >
                        <label>
                            Cidade
                            <select
                                value={city}
                                onChange={(event) =>
                                    setCity(event.target.value)
                                }
                            >
                                {maps.map((candidate) => (
                                    <option
                                        key={candidate.id}
                                        value={candidate.id}
                                    >
                                        {candidate.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <Button
                            type="submit"
                            disabled={busy || nickname.trim().length < 2}
                        >
                            Criar sala
                        </Button>
                    </form>
                    <form
                        onSubmit={(event) => {
                            event.preventDefault()
                            void client.join(code, nickname)
                        }}
                    >
                        <label>
                            Código da sala
                            <input
                                value={code}
                                onChange={(event) =>
                                    setCode(event.target.value.toUpperCase())
                                }
                                maxLength={6}
                                autoComplete="off"
                            />
                        </label>
                        <Button
                            type="submit"
                            disabled={
                                busy ||
                                nickname.trim().length < 2 ||
                                code.trim().length !== 6
                            }
                        >
                            Entrar na sala
                        </Button>
                    </form>
                </Panel>
            ) : null}
            {room && !map ? (
                <p role="alert">
                    Esta cidade não está disponível nesta versão. Saia da sala e
                    atualize o aplicativo.
                </p>
            ) : null}
        </main>
    )
}
