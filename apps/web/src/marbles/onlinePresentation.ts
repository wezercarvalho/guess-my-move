import { type Competitor, type RoomState } from '@guess-my-move/marbles'

export const otherPlayer = (role: Competitor): Competitor =>
    role === 'player' ? 'opponent' : 'player'
export function playerName(room: RoomState, role: Competitor): string {
    return (
        room.players[role].nickname ??
        (role === 'player' ? 'Jogador 1' : 'Jogador 2')
    )
}
export function playerLabel(
    room: RoomState,
    role: Competitor,
    ownRole: Competitor,
): string {
    return `${playerName(room, role)}${role === ownRole ? ' (Você)' : ''}`
}

/** Somente apresentação: a previsão da vez e a física pertencem ao servidor. */
export function onlineTurn(
    room: RoomState,
    ownRole: Competitor,
): { now: string; next: string } {
    if (room.status === 'paused')
        return {
            now: 'Partida pausada',
            next: 'A sequência será retomada quando os dois estiverem conectados.',
        }
    const match = room.match
    if (!match)
        return {
            now: 'Aguardando início',
            next: 'A partida começa quando ambos estiverem prontos.',
        }
    if (match.phase === 'match-over')
        return {
            now: 'Partida encerrada',
            next: 'Os dois podem confirmar uma nova partida nesta sala.',
        }
    const next = room.nextTurn
        ? playerLabel(room, room.nextTurn, ownRole)
        : null
    if (match.phase === 'round-over')
        return {
            now: 'Rodada encerrada',
            next: next
                ? `Próxima rodada: ${next}`
                : 'Aguardando a próxima rodada.',
        }
    const name = match.turn ? playerLabel(room, match.turn, ownRole) : '—'
    const now = room.intent
        ? `Tiro de ${name} confirmado`
        : match.phase === 'rolling'
          ? `Bolinha de ${name} em movimento`
          : match.turn === ownRole
            ? `Sua vez · ${name}`
            : `Vez de ${name}`
    return {
        now,
        next: next
            ? `Na sequência: ${next}, se a rodada continuar.`
            : 'Aguardando o resultado do tiro para definir a sequência.',
    }
}

export function onlineWaiting(room: RoomState, role: Competitor): string {
    const rival = otherPlayer(role)
    if (room.status === 'paused') {
        const absent = (['player', 'opponent'] as const)
            .filter((key) => !room.players[key].connected)
            .map((key) => playerName(room, key))
        return `Partida pausada. Aguardando ${absent.join(' e ')} reconectar por até 60 segundos.`
    }
    if (!room.players[rival].connected)
        return 'Aguardando outra pessoa entrar pelo código da sala.'
    if (!room.players[role].ready)
        return 'Os dois estão na sala. Marque “Estou pronto” para começar.'
    return `Você está pronto. Aguardando ${playerName(room, rival)} ficar pronto.`
}
