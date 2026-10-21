import { acenarCard, toPublicCard } from '@guess-my-move/core'
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

const card = toPublicCard(acenarCard)

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
    it('mostra a carta pública (palavra, dica, sugestão) e nunca a avaliação', () => {
        render(<PocScreen card={card} cameraGetUserMedia={vi.fn()} />)
        expect(screen.getByText('Acenar')).toBeInTheDocument()
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
