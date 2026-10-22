import { acenarCard } from '@guess-my-move/core'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { PocScreen } from './PocScreen.js'
import {
    type CaptureCanvas,
    type CaptureDeps,
} from '../capture/frameCapture.js'
import { createFakeStream } from '../test-utils/fakeMedia.js'

beforeAll(() => {
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
        configurable: true,
        value: vi.fn().mockResolvedValue(undefined),
    })
    Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', {
        configurable: true,
        writable: true,
        value: null,
    })
})

const card = acenarCard

/** Deps de captura simuladas: canvas falso, relógio e sleep instantâneos. */
function fakeCaptureDeps(): CaptureDeps {
    const canvas: CaptureCanvas = {
        getContext: () => ({ drawImage: vi.fn() }),
        toDataURL: () => 'data:image/jpeg;base64,AAAA',
    }
    let t = 0
    return {
        now: () => (t += 10),
        sleep: () => Promise.resolve(),
        createCanvas: () => canvas,
    }
}

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })
}

/** Ativa a câmera e espera o preview ficar ativo. */
async function activateCamera() {
    fireEvent.click(screen.getByRole('button', { name: /ativar câmera/i }))
    await waitFor(() =>
        screen.getByRole('button', { name: /parar câmera/i }),
    )
}

describe('PocScreen', () => {
    it('mostra a carta pública (palavra, dica, sugestão sob demanda) e nunca a avaliação', () => {
        render(<PocScreen card={card} cameraGetUserMedia={vi.fn()} />)
        expect(screen.getByText('Acenar')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: /mostrar dica/i }))
        fireEvent.click(
            screen.getByRole('button', { name: /mostrar sugestão/i }),
        )
        expect(screen.getByText(/cumprimentar ou se despedir/i)).toBeInTheDocument()
        expect(screen.getByText(/movimente-a de um lado/i)).toBeInTheDocument()
        // A resposta canônica/aliases NÃO aparecem na tela.
        expect(screen.queryByText(/dar tchau/i)).not.toBeInTheDocument()
        expect(screen.queryByText(/waving/i)).not.toBeInTheDocument()
    })

    it('desabilita capturar até a câmera estar ativa', () => {
        render(<PocScreen card={card} cameraGetUserMedia={vi.fn()} />)
        expect(
            screen.getByRole('button', { name: /capturar e adivinhar/i }),
        ).toBeDisabled()
    })

    it('fluxo de sucesso: captura, adivinha e exibe palpite com duração', async () => {
        const { stream } = createFakeStream()
        const getUserMedia = vi.fn().mockResolvedValue(stream)
        const fetchImpl = vi
            .fn()
            .mockResolvedValue(
                jsonResponse({
                    guess: 'acenar',
                    durationMs: 3200,
                    providerId: 'mock',
                }),
            )

        render(
            <PocScreen
                card={card}
                cameraGetUserMedia={getUserMedia}
                flowDeps={{
                    captureDeps: fakeCaptureDeps(),
                    clientOptions: { fetchImpl },
                }}
            />,
        )

        await activateCamera()
        fireEvent.click(
            screen.getByRole('button', { name: /capturar e adivinhar/i }),
        )

        const result = await screen.findByTestId('guess-result')
        expect(result).toHaveTextContent(/palpite da ia/i)
        expect(result).toHaveTextContent(/acenar/i)
        expect(result).toHaveTextContent(/3,2 s/)
        // O corpo enviado não contém a palavra-alvo.
        const init = fetchImpl.mock.calls[0][1] as RequestInit
        const body = JSON.parse(init.body as string) as Record<string, unknown>
        expect(JSON.stringify(body).toLowerCase()).not.toContain('acenar')
        expect(body).toHaveProperty('frames')
        expect(body).not.toHaveProperty('word')
    })

    it('erro estável: mostra mensagem e mantém a câmera utilizável', async () => {
        const { stream } = createFakeStream()
        const getUserMedia = vi.fn().mockResolvedValue(stream)
        const fetchImpl = vi.fn().mockResolvedValue(
            jsonResponse(
                {
                    error: {
                        code: 'provider_error',
                        message: 'provedor falhou',
                        retryable: true,
                    },
                },
                502,
            ),
        )

        render(
            <PocScreen
                card={card}
                cameraGetUserMedia={getUserMedia}
                flowDeps={{
                    captureDeps: fakeCaptureDeps(),
                    clientOptions: { fetchImpl },
                }}
            />,
        )

        await activateCamera()
        fireEvent.click(
            screen.getByRole('button', { name: /capturar e adivinhar/i }),
        )

        const alert = await screen.findByRole('alert')
        expect(alert).toHaveTextContent(/provedor de ia falhou|provedor falhou/i)
        expect(alert).toHaveTextContent(/câmera continua ativa/i)
        // Não há palpite exibido.
        expect(screen.queryByTestId('guess-result')).not.toBeInTheDocument()
        // Câmera ainda ativa e botão Tentar novamente disponível.
        expect(
            screen.getByRole('button', { name: /parar câmera/i }),
        ).toBeInTheDocument()
        expect(
            screen.getByRole('button', { name: /tentar novamente/i }),
        ).toBeInTheDocument()
    })

    it('timeout do provedor leva a estado de erro recuperável', async () => {
        const { stream } = createFakeStream()
        const getUserMedia = vi.fn().mockResolvedValue(stream)
        const fetchImpl = vi.fn(
            (_input: string, init?: RequestInit) =>
                new Promise<Response>((_resolve, reject) => {
                    init?.signal?.addEventListener('abort', () => {
                        const err = new Error('aborted')
                        err.name = 'AbortError'
                        reject(err)
                    })
                }),
        )

        render(
            <PocScreen
                card={card}
                cameraGetUserMedia={getUserMedia}
                flowDeps={{
                    captureDeps: fakeCaptureDeps(),
                    clientOptions: { fetchImpl, timeoutMs: 10 },
                }}
            />,
        )

        await activateCamera()
        fireEvent.click(
            screen.getByRole('button', { name: /capturar e adivinhar/i }),
        )

        const alert = await screen.findByRole('alert')
        expect(alert).toHaveTextContent(/demorou demais|tente novamente/i)
        expect(
            screen.getByRole('button', { name: /tentar novamente/i }),
        ).toBeInTheDocument()
    })

    it('insufficientEvidence é diferenciado de um palpite', async () => {
        const { stream } = createFakeStream()
        const getUserMedia = vi.fn().mockResolvedValue(stream)
        const fetchImpl = vi.fn().mockResolvedValue(
            jsonResponse({
                guess: '',
                insufficientEvidence: true,
                durationMs: 1000,
                providerId: 'mock',
            }),
        )

        render(
            <PocScreen
                card={card}
                cameraGetUserMedia={getUserMedia}
                flowDeps={{
                    captureDeps: fakeCaptureDeps(),
                    clientOptions: { fetchImpl },
                }}
            />,
        )

        await activateCamera()
        fireEvent.click(
            screen.getByRole('button', { name: /capturar e adivinhar/i }),
        )

        const result = await screen.findByTestId('guess-result')
        expect(result).toHaveTextContent(/evidência suficiente/i)
        expect(result).not.toHaveTextContent(/palpite da ia/i)
    })
})

/** Respostas do servidor para os testes do fluxo de rodada. */
function guessResponse(guess: string, extra: Record<string, unknown> = {}) {
    return jsonResponse({
        guess,
        durationMs: 1000,
        providerId: 'mock',
        ...extra,
    })
}

/** Renderiza a tela com a câmera já ativa e um `fetch` simulado em fila. */
async function renderActive(
    responses: Response[],
    extraProps: { maxAttempts?: number } = {},
) {
    const { stream } = createFakeStream()
    const fetchImpl = vi.fn()
    for (const response of responses) {
        fetchImpl.mockResolvedValueOnce(response)
    }
    render(
        <PocScreen
            card={card}
            cameraGetUserMedia={vi.fn().mockResolvedValue(stream)}
            flowDeps={{
                captureDeps: fakeCaptureDeps(),
                clientOptions: { fetchImpl },
            }}
            {...extraProps}
        />,
    )
    await activateCamera()
    return fetchImpl
}

function captureOnce() {
    fireEvent.click(screen.getByRole('button', { name: /capturar e adivinhar/i }))
}

function sentBody(fetchImpl: ReturnType<typeof vi.fn>, call: number) {
    const init = fetchImpl.mock.calls[call]?.[1] as RequestInit
    return JSON.parse(init.body as string) as Record<string, unknown>
}

describe('PocScreen — rodada com motor e árbitro (#55)', () => {
    it('mostra 0 de N tentativas antes de qualquer captura', async () => {
        await renderActive([])
        expect(screen.getByTestId('round-status')).toHaveTextContent(
            /0 de 3/,
        )
        expect(screen.queryByTestId('round-verdict')).not.toBeInTheDocument()
    })

    it('palpite errado: tente de novo, mostra o rejeitado e o reenvia', async () => {
        const fetchImpl = await renderActive([
            guessResponse('dançar'),
            guessResponse('acenar'),
        ])

        captureOnce()
        const verdict = await screen.findByTestId('round-verdict')
        expect(verdict).toHaveTextContent(/não foi dessa vez/i)
        expect(screen.getByTestId('round-status')).toHaveTextContent(/1 de 3/)
        expect(screen.getByTestId('rejected-guesses')).toHaveTextContent(
            /dançar/,
        )
        // Pode capturar de novo, sem precisar de outro botão.
        const again = screen.getByRole('button', {
            name: /capturar e adivinhar/i,
        })
        expect(again).toBeEnabled()

        fireEvent.click(again)
        await waitFor(() =>
            expect(screen.getByTestId('round-verdict')).toHaveTextContent(
                /acertou/i,
            ),
        )
        expect(screen.getByTestId('round-status')).toHaveTextContent(/2 de 3/)

        // O 1º envio não leva rejeitados; o 2º leva só o palpite da IA.
        expect(sentBody(fetchImpl, 0)).not.toHaveProperty('rejectedGuesses')
        expect(sentBody(fetchImpl, 1).rejectedGuesses).toEqual(['dançar'])
        // Nenhum dado da carta cruza a fronteira.
        for (const call of [0, 1]) {
            expect(Object.keys(sentBody(fetchImpl, call)).sort()).toEqual(
                call === 0 ? ['frames'] : ['frames', 'rejectedGuesses'],
            )
        }
    })

    it('ao acertar, encerra a rodada: sem nova captura e com "Nova rodada"', async () => {
        await renderActive([guessResponse('dar tchau')])
        captureOnce()
        expect(await screen.findByTestId('round-verdict')).toHaveTextContent(
            /acertou/i,
        )
        expect(
            screen.getByRole('button', { name: /capturar e adivinhar/i }),
        ).toBeDisabled()
        expect(
            screen.getByRole('button', { name: /nova rodada/i }),
        ).toBeEnabled()
    })

    it('esgotar as tentativas encerra sem acerto', async () => {
        await renderActive(
            [guessResponse('dançar'), guessResponse('pular')],
            { maxAttempts: 2 },
        )
        captureOnce()
        await screen.findByTestId('round-verdict')
        await waitFor(() =>
            expect(
                screen.getByRole('button', { name: /capturar e adivinhar/i }),
            ).toBeEnabled(),
        )
        captureOnce()
        await waitFor(() =>
            expect(screen.getByTestId('round-verdict')).toHaveTextContent(
                /fim da rodada/i,
            ),
        )
        expect(screen.getByTestId('round-status')).toHaveTextContent(/2 de 2/)
        expect(
            screen.getByRole('button', { name: /capturar e adivinhar/i }),
        ).toBeDisabled()
        expect(
            screen.getByRole('button', { name: /nova rodada/i }),
        ).toBeEnabled()
    })

    it('erro recuperável não consome tentativa', async () => {
        await renderActive([
            jsonResponse(
                {
                    error: {
                        code: 'provider_error',
                        message: 'falhou',
                        retryable: true,
                    },
                },
                502,
            ),
            guessResponse('dançar'),
        ])
        captureOnce()
        await screen.findByRole('alert')
        expect(screen.getByTestId('round-status')).toHaveTextContent(/0 de 3/)

        fireEvent.click(
            screen.getByRole('button', { name: /tentar novamente/i }),
        )
        captureOnce()
        await screen.findByTestId('round-verdict')
        expect(screen.getByTestId('round-status')).toHaveTextContent(/1 de 3/)
    })

    it('evidência insuficiente não consome tentativa', async () => {
        await renderActive([
            guessResponse('', { insufficientEvidence: true }),
        ])
        captureOnce()
        await screen.findByTestId('guess-result')
        expect(screen.getByTestId('round-status')).toHaveTextContent(/0 de 3/)
        expect(
            screen.getByRole('button', { name: /capturar e adivinhar/i }),
        ).toBeEnabled()
    })

    it('"Nova rodada" zera tentativas, rejeitados e a revelação de dica e sugestão', async () => {
        await renderActive([guessResponse('dançar')])
        fireEvent.click(screen.getByRole('button', { name: /mostrar dica/i }))
        captureOnce()
        await screen.findByTestId('round-verdict')
        expect(screen.getByTestId('rejected-guesses')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: /nova rodada/i }))

        expect(screen.getByTestId('round-status')).toHaveTextContent(/0 de 3/)
        expect(screen.queryByTestId('round-verdict')).not.toBeInTheDocument()
        expect(
            screen.queryByTestId('rejected-guesses'),
        ).not.toBeInTheDocument()
        expect(
            screen.queryByText(/cumprimentar ou se despedir/i),
        ).not.toBeInTheDocument()
    })
})
