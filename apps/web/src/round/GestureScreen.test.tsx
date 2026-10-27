import { acenarCard } from '@guess-my-move/core'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { namedError, createFakeStream } from '../test-utils/fakeMedia.js'
import { type HandTracker } from '../tracker/handTracker.js'
import { GestureScreen } from './GestureScreen.js'
import { type GestureRoundDeps } from './useGestureRound.js'

/** Estado do vídeo simulado: o jsdom não decodifica nem anima vídeo. */
const media = { currentTime: 0 }

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
    Object.defineProperty(HTMLMediaElement.prototype, 'readyState', {
        configurable: true,
        get: () => 4,
    })
    Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {
        configurable: true,
        get: () => media.currentTime,
    })
    Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', {
        configurable: true,
        get: () => 640,
    })
    Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', {
        configurable: true,
        get: () => 480,
    })
})

beforeEach(() => {
    media.currentTime = 0
})

afterEach(() => {
    vi.restoreAllMocks()
})

/** 21 landmarks com o pulso e o início do dedo médio no ângulo pedido (imagem 4:3). */
function handAt(angleDeg: number) {
    const radians = (angleDeg * Math.PI) / 180
    const points = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5 }))
    points[0] = { x: 0.5, y: 0.8 }
    points[9] = {
        x: 0.5 + (0.3 * Math.sin(radians)) / (640 / 480),
        y: 0.8 - 0.3 * Math.cos(radians),
    }
    return { landmarks: points }
}

/** Relógio, quadros e detector controlados pelo teste. */
function harness(options: {
    angles?: (frame: number) => number | null
    createTracker?: GestureRoundDeps['createTracker']
    delegate?: 'GPU' | 'CPU'
}) {
    let nowMs = 1000
    let queued: (() => void) | null = null
    let frame = 0
    const detect = vi.fn((): ReturnType<HandTracker['detect']> => {
        const angle = options.angles?.(frame) ?? null
        return angle === null ? null : handAt(angle)
    })
    const close = vi.fn()
    const tracker: HandTracker = { delegate: options.delegate ?? 'GPU', detect, close }
    const createTracker = options.createTracker ?? vi.fn(() => Promise.resolve(tracker))
    const deps: GestureRoundDeps = {
        createTracker,
        now: () => nowMs,
        requestFrame: (callback) => {
            queued = callback
            return 1
        },
        cancelFrame: () => {
            queued = null
        },
    }
    return {
        deps,
        detect,
        close,
        createTracker,
        /** Avança `count` quadros de `stepMs` ms cada, com um novo quadro de vídeo por passo. */
        run(count: number, stepMs = 100) {
            for (let i = 0; i < count; i++) {
                const callback = queued
                if (!callback) return
                queued = null
                nowMs += stepMs
                media.currentTime += stepMs / 1000
                frame++
                act(() => {
                    callback()
                })
            }
        },
        stepWithoutNewFrame() {
            const callback = queued
            if (!callback) return
            queued = null
            act(() => {
                callback()
            })
        },
    }
}

function renderScreen(h: ReturnType<typeof harness>, getUserMedia?: () => Promise<MediaStream>) {
    const stream = createFakeStream().stream
    return render(
        <GestureScreen
            card={acenarCard}
            cameraGetUserMedia={getUserMedia ?? vi.fn(() => Promise.resolve(stream))}
            deps={h.deps}
        />,
    )
}

async function activateCamera() {
    fireEvent.click(screen.getByRole('button', { name: /ativar câmera/i }))
    await waitFor(() => screen.getByRole('button', { name: /parar câmera/i }))
}

async function readyToStart() {
    await activateCamera()
    await waitFor(() => {
        expect(screen.getByRole('button', { name: /começar/i })).toBeEnabled()
    })
}

describe('GestureScreen — antes de começar', () => {
    it('mostra a carta pública e nunca o critério de avaliação', () => {
        const h = harness({})
        renderScreen(h)
        expect(screen.getByText('Acenar')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: /mostrar dica/i }))
        expect(screen.getByText(/cumprimentar ou se despedir/i)).toBeInTheDocument()
        expect(screen.queryByText(/hand-angle-oscillation|amplitudeDeg|minReversals/i)).toBeNull()
    })

    it('informa que o processamento é local e não envia imagens', () => {
        const h = harness({})
        renderScreen(h)
        expect(screen.getByRole('note')).toHaveTextContent(/no seu navegador/i)
        expect(screen.getByRole('note')).toHaveTextContent(/nenhuma imagem/i)
    })

    it('desabilita Começar sem câmera e não carrega o detector', () => {
        const h = harness({})
        renderScreen(h)
        expect(screen.getByRole('button', { name: /começar/i })).toBeDisabled()
        expect(h.createTracker).not.toHaveBeenCalled()
        expect(screen.getByTestId('round-status')).toHaveTextContent(/ative a câmera/i)
    })

    it('mostra o carregamento do detector e habilita Começar quando pronto', async () => {
        let release: (tracker: HandTracker) => void = () => undefined
        const pending = new Promise<HandTracker>((resolve) => {
            release = resolve
        })
        const h = harness({ createTracker: () => pending })
        renderScreen(h)
        await activateCamera()
        expect(screen.getByRole('button', { name: /começar/i })).toBeDisabled()
        await waitFor(() => {
            expect(screen.getByTestId('round-status')).toHaveTextContent(
                /carregando o detector/i,
            )
        })

        await act(async () => {
            release({ delegate: 'CPU', detect: () => null, close: () => undefined })
            await Promise.resolve()
        })
        await waitFor(() => {
            expect(screen.getByRole('button', { name: /começar/i })).toBeEnabled()
        })
        expect(screen.getByTestId('round-status')).toHaveTextContent(/aperte começar/i)
    })

    it('câmera negada: explica, não carrega o detector e mantém Começar desabilitado', async () => {
        const h = harness({})
        renderScreen(h, () => Promise.reject(namedError('NotAllowedError')))
        fireEvent.click(screen.getByRole('button', { name: /ativar câmera/i }))
        await waitFor(() => screen.getByRole('alert'))
        expect(h.createTracker).not.toHaveBeenCalled()
        expect(screen.getByRole('button', { name: /começar/i })).toBeDisabled()
        await waitFor(() => {
            expect(screen.getByTestId('round-status')).toHaveTextContent(/sem a câmera/i)
        })
    })
})

describe('GestureScreen — durante a rodada', () => {
    it('reconhece o aceno e encerra a rodada', async () => {
        // Oscilação de ±30° em ciclos de 8 quadros.
        const h = harness({ angles: (f) => 30 * Math.sin((f * Math.PI) / 4) })
        renderScreen(h)
        await readyToStart()
        fireEvent.click(screen.getByRole('button', { name: /começar/i }))
        expect(screen.getByRole('button', { name: /cancelar/i })).toBeInTheDocument()

        h.run(40)
        expect(screen.getByTestId('round-result')).toHaveTextContent(/gesto reconhecido/i)
        expect(screen.getByRole('button', { name: /nova rodada/i })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /cancelar/i })).toBeNull()
        expect(screen.getByRole('button', { name: /começar/i })).toBeDisabled()
    })

    it('não reconhece sem mão e termina por tempo', async () => {
        const h = harness({ angles: () => null })
        renderScreen(h)
        await readyToStart()
        fireEvent.click(screen.getByRole('button', { name: /começar/i }))
        h.run(12, 1000)
        expect(screen.getByTestId('round-result')).toHaveTextContent(/não reconhecido/i)
    })

    it('não reconhece um movimento pequeno, como coçar a cabeça ou mão parada', async () => {
        const h = harness({ angles: (f) => 4 * Math.sin((f * Math.PI) / 4) })
        renderScreen(h)
        await readyToStart()
        fireEvent.click(screen.getByRole('button', { name: /começar/i }))
        h.run(110, 100)
        expect(screen.getByTestId('round-result')).toHaveTextContent(/não reconhecido/i)
        expect(screen.queryByText(/gesto reconhecido/i)).toBeNull()
    })

    it('processa um quadro novo por vez e ignora quadros repetidos', async () => {
        const h = harness({ angles: () => 0 })
        renderScreen(h)
        await readyToStart()
        fireEvent.click(screen.getByRole('button', { name: /começar/i }))
        h.run(1)
        const after = h.detect.mock.calls.length
        h.stepWithoutNewFrame()
        h.stepWithoutNewFrame()
        expect(h.detect.mock.calls.length).toBe(after)
        h.run(1)
        expect(h.detect.mock.calls.length).toBe(after + 1)
    })

    it('Cancelar encerra a rodada', async () => {
        const h = harness({ angles: () => 0 })
        renderScreen(h)
        await readyToStart()
        fireEvent.click(screen.getByRole('button', { name: /começar/i }))
        h.run(2)
        fireEvent.click(screen.getByRole('button', { name: /cancelar/i }))
        expect(screen.getByTestId('round-result')).toHaveTextContent(/rodada cancelada/i)
        expect(screen.getByRole('button', { name: /nova rodada/i })).toBeInTheDocument()
    })

    it('desenha a mão sobre o vídeo e mostra os números de depuração', async () => {
        const arc = vi.fn()
        const context = {
            clearRect: vi.fn(),
            beginPath: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            stroke: vi.fn(),
            arc,
            fill: vi.fn(),
        }
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
            context as unknown as CanvasRenderingContext2D,
        )
        const h = harness({ angles: (f) => 30 * Math.sin((f * Math.PI) / 4), delegate: 'GPU' })
        renderScreen(h)
        await readyToStart()
        fireEvent.click(screen.getByRole('button', { name: /começar/i }))
        h.run(2)
        expect(arc).toHaveBeenCalled()
        expect(arc.mock.calls.length % 21).toBe(0)
        const panel = screen.getByRole('region', { name: /depuração/i })
        expect(panel).toHaveTextContent('GPU')
        expect(panel).toHaveTextContent(/quadros processados/i)
    })

    it('não faz nenhuma requisição de rede durante a rodada', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch')
        const h = harness({ angles: (f) => 30 * Math.sin((f * Math.PI) / 4) })
        renderScreen(h)
        await readyToStart()
        fireEvent.click(screen.getByRole('button', { name: /começar/i }))
        h.run(40)
        expect(fetchSpy).not.toHaveBeenCalled()
    })
})

describe('GestureScreen — falhas e nova rodada', () => {
    it('falha ao carregar o detector: mostra o erro e permite tentar de novo', async () => {
        const createTracker = vi
            .fn<NonNullable<GestureRoundDeps['createTracker']>>()
            .mockRejectedValueOnce(new Error('modelo ausente'))
            .mockResolvedValue({ delegate: 'CPU', detect: () => null, close: () => undefined })
        const h = harness({ createTracker })
        renderScreen(h)
        await activateCamera()
        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent(/modelo ausente/i)
        })
        expect(screen.getByRole('button', { name: /começar/i })).toBeDisabled()

        fireEvent.click(screen.getByRole('button', { name: /nova rodada/i }))
        await waitFor(() => {
            expect(screen.getByRole('button', { name: /começar/i })).toBeEnabled()
        })
        expect(createTracker).toHaveBeenCalledTimes(2)
    })

    it('erro de inferência durante a rodada encerra sem reconhecer', async () => {
        const h = harness({ angles: () => 0 })
        h.detect.mockImplementationOnce(() => {
            throw new Error('falha de inferência')
        })
        renderScreen(h)
        await readyToStart()
        fireEvent.click(screen.getByRole('button', { name: /começar/i }))
        h.run(1)
        expect(screen.getByRole('alert')).toHaveTextContent(/falha de inferência/i)
        expect(screen.queryByText(/gesto reconhecido/i)).toBeNull()
    })

    it('nova rodada reaproveita o detector já carregado', async () => {
        const h = harness({ angles: (f) => 30 * Math.sin((f * Math.PI) / 4) })
        renderScreen(h)
        await readyToStart()
        fireEvent.click(screen.getByRole('button', { name: /começar/i }))
        h.run(40)
        fireEvent.click(screen.getByRole('button', { name: /nova rodada/i }))
        await waitFor(() => {
            expect(screen.getByRole('button', { name: /começar/i })).toBeEnabled()
        })
        expect(h.createTracker).toHaveBeenCalledTimes(1)
        expect(screen.queryByText(/gesto reconhecido/i)).toBeNull()
    })

    it('libera o detector ao desmontar', async () => {
        const h = harness({})
        const view = renderScreen(h)
        await readyToStart()
        view.unmount()
        expect(h.close).toHaveBeenCalledTimes(1)
    })
})
