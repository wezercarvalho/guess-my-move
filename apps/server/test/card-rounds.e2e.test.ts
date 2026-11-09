import type { INestApplication } from '@nestjs/common'
import type { AddressInfo } from 'node:net'
import {
    cardRoundAccessSchema,
    cardRoundSnapshotSchema,
} from '@guess-my-move/core'
import { afterEach, describe, expect, it } from 'vitest'
import { createServerApp } from '../src/app.setup.js'

let app: INestApplication | undefined
async function start() {
    app = await createServerApp({ logger: false })
    await app.listen(0, '127.0.0.1')
    const address = (
        app.getHttpServer() as { address(): AddressInfo }
    ).address()
    return `http://127.0.0.1:${address.port}/api/cards/rounds`
}
async function post(
    url: string,
    body: unknown,
    token?: string,
    origin = 'http://localhost:5173',
) {
    return fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Origin: origin,
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
    })
}
afterEach(async () => {
    try {
        await app?.close()
    } finally {
        app = undefined
    }
})

describe('HTTP de rodadas de cartas', () => {
    it('reconhece e pontua usando relógio e critério reais sem devolver metadados privados', async () => {
        const url = await start()
        const response = await post(url, {
            cardId: 'wave-001',
            locale: 'en-US',
        })
        expect(response.status).toBe(201)
        expect(response.headers.get('cache-control')).toBe('no-store')
        const access = cardRoundAccessSchema.parse(await response.json())
        expect(access.round.card.public.word).toBe('Wave')
        let snapshot = access.round
        for (const [index, angleDeg] of [0, 60, -60, 60, -60, 60].entries()) {
            await new Promise((resolve) => setTimeout(resolve, 120))
            const observed = await post(
                `${url}/${access.roundId}/observe`,
                { seq: index + 1, angleDeg },
                access.token,
            )
            expect(observed.status).toBe(200)
            snapshot = cardRoundSnapshotSchema.parse(await observed.json())
        }
        expect(snapshot.state).toBe('recognized')
        expect(snapshot.score).toBeGreaterThan(50)
        expect(snapshot.score).toBeLessThanOrEqual(100)
        expect(JSON.stringify(snapshot)).not.toMatch(
            /evaluation|criterion|amplitudeDeg|basePoints|token/,
        )
        const final = await post(
            `${url}/${access.roundId}/cancel`,
            {},
            access.token,
        )
        expect(await final.json()).toEqual(snapshot)
    })
    it('valida corpo/origem/token, rejeita autoridade do cliente e cancela sem pontos', async () => {
        const url = await start()
        expect(
            (
                await post(
                    url,
                    { cardId: 'wave-001', locale: 'pt-BR' },
                    undefined,
                    'https://untrusted.example',
                )
            ).status,
        ).toBe(403)
        expect(
            (
                await post(url, {
                    cardId: 'wave-001',
                    locale: 'pt-BR',
                    score: 999999,
                })
            ).status,
        ).toBe(400)
        expect(
            (await post(url, { cardId: 'missing', locale: 'pt-BR' })).status,
        ).toBe(404)
        expect(
            (await post(url, { cardId: 'wave-001', locale: 'invalid' })).status,
        ).toBe(400)
        const access = cardRoundAccessSchema.parse(
            await (
                await post(url, { cardId: 'wave-001', locale: 'pt-BR' })
            ).json(),
        )
        const path = `${url}/${access.roundId}/observe`
        expect(
            (await post(path, { seq: 1, angleDeg: 0 }, 'x'.repeat(32))).status,
        ).toBe(401)
        expect(
            (
                await post(
                    path,
                    {
                        seq: 1,
                        angleDeg: 0,
                        elapsedMs: 1,
                        score: 999999,
                        recognized: true,
                    },
                    access.token,
                )
            ).status,
        ).toBe(400)
        expect(
            (await post(path, { seq: 1, angleDeg: 999 }, access.token)).status,
        ).toBe(400)
        expect(
            (await post(path, { seq: 1, angleDeg: 0 }, access.token)).status,
        ).toBe(200)
        expect(
            (await post(path, { seq: 1, angleDeg: 0 }, access.token)).status,
        ).toBe(409)
        const oversized = await post(url, {
            cardId: 'x'.repeat(4096),
            locale: 'pt-BR',
        })
        expect(oversized.status).toBe(413)
        const cancelled = await post(
            `${url}/${access.roundId}/cancel`,
            {},
            access.token,
        )
        expect(cancelled.status).toBe(200)
        expect(await cancelled.json()).toMatchObject({
            state: 'user_cancelled',
            score: 0,
        })
    })
})
