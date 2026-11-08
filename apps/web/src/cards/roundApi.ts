import {
    cardRoundAccessSchema,
    cardRoundSnapshotSchema,
    type CardRoundAccess,
    type CardRoundSnapshot,
    type ObserveCardRound,
    type StartCardRound,
} from '@guess-my-move/core'

export interface CardRoundApi {
    start(
        this: void,
        command: StartCardRound,
        signal: AbortSignal,
    ): Promise<CardRoundAccess>
    observe(
        this: void,
        access: CardRoundAccess,
        command: ObserveCardRound,
        signal: AbortSignal,
    ): Promise<CardRoundSnapshot>
    cancel(this: void, access: CardRoundAccess): Promise<CardRoundSnapshot>
}

export function createCardRoundApi(
    request: typeof fetch = fetch,
): CardRoundApi {
    async function post(
        path: string,
        body: unknown,
        signal: AbortSignal,
        token?: string,
    ): Promise<unknown> {
        const response = await request(
            `${import.meta.env.BASE_URL}api/cards/rounds${path}`,
            {
                method: 'POST',
                cache: 'no-store',
                credentials: 'omit',
                signal: AbortSignal.any([signal, AbortSignal.timeout(4000)]),
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify(body),
            },
        )
        if (!response.ok) throw new Error('Servidor de rodadas indisponível.')
        return response.json() as Promise<unknown>
    }
    return {
        async start(command, signal) {
            return cardRoundAccessSchema.parse(await post('', command, signal))
        },
        async observe(access, command, signal) {
            return cardRoundSnapshotSchema.parse(
                await post(
                    `/${encodeURIComponent(access.roundId)}/observe`,
                    command,
                    signal,
                    access.token,
                ),
            )
        },
        async cancel(access) {
            return cardRoundSnapshotSchema.parse(
                await post(
                    `/${encodeURIComponent(access.roundId)}/cancel`,
                    {},
                    AbortSignal.timeout(2000),
                    access.token,
                ),
            )
        },
    }
}
