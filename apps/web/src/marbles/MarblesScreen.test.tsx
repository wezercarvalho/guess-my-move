import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { CLOSED_RATIO, OPEN_RATIO, pinchHand } from '../test-utils/fakeHand.js'
import { createFakeStream, namedError } from '../test-utils/fakeMedia.js'
import { type HandTracker, type TrackedHand } from '../tracker/handTracker.js'
import { MarblesScreen } from './MarblesScreen.js'
import { type MarblesDeps } from './useMarblesGame.js'

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

const arcSpy = vi.fn()

beforeEach(() => {
    media.currentTime = 0
    arcSpy.mockClear()
    const context = new Proxy(
        {},
        {
            get: (_target, name) => (name === 'arc' ? arcSpy : () => ({ addColorStop: vi.fn() })),
            set: () => true,
        },
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
        context as unknown as CanvasRenderingContext2D,
    )
})

afterEach(() => {
    vi.restoreAllMocks()
})

function harness(options: { createTracker?: MarblesDeps['createTracker'] } = {}) {
    let nowMs = 1000
    let queued: (() => void) | null = null
    let next: TrackedHand | null = null
    const tracker: HandTracker = { delegate: 'GPU', detect: vi.fn(() => next), close: vi.fn() }
    const deps: MarblesDeps = {
        createTracker: options.createTracker ?? vi.fn(() => Promise.resolve(tracker)),
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
        run(hand: TrackedHand | null, count = 1, stepMs = 33) {
            for (let i = 0; i < count; i++) {
                const callback = queued
                if (!callback) return
                queued = null
                next = hand
                nowMs += stepMs
                media.currentTime += stepMs / 1000
                act(() => {
                    callback()
                })
            }
        },
    }
}

function renderScreen(h: ReturnType<typeof harness>, getUserMedia?: () => Promise<MediaStream>) {
    const stream = createFakeStream().stream
    return render(
        <MarblesScreen
            cameraGetUserMedia={getUserMedia ?? vi.fn(() => Promise.resolve(stream))}
            deps={h.deps}
        />,
    )
}

async function readyToPlay() {
    fireEvent.click(screen.getByRole('button', { name: /ativar câmera/i }))
    await waitFor(() => {
        expect(screen.getByTestId('game-status')).toHaveTextContent(/não estou vendo a sua mão/i)
    })
}

const open = (x: number, y: number) => pinchHand({ ratio: OPEN_RATIO, x, y })
const closed = (x: number, y: number) => pinchHand({ ratio: CLOSED_RATIO, x, y })

describe('MarblesScreen', () => {
    it('mostra o título, o aviso de privacidade, o campo, o contador e o painel de depuração', () => {
        renderScreen(harness())
        expect(screen.getByRole('heading', { name: /bolinhas de gude/i })).toBeInTheDocument()
        expect(screen.getByRole('note')).toHaveTextContent(/nenhuma imagem/i)
        expect(screen.getByLabelText(/campo do jogo/i)).toBeInTheDocument()
        expect(screen.getByTestId('shot-counter')).toHaveTextContent('Tiros: 0')
        expect(screen.getByRole('heading', { name: /depuração/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /ativar câmera/i })).toBeInTheDocument()
    })

    it('antes da câmera, orienta a ativá-la', () => {
        renderScreen(harness())
        expect(screen.getByTestId('game-status')).toHaveTextContent(/ative a câmera/i)
    })

    it('anuncia o estado em uma região aria-live educada', () => {
        renderScreen(harness())
        expect(screen.getByTestId('game-status')).toHaveAttribute('aria-live', 'polite')
    })

    it('com a mão à vista, explica como atirar', async () => {
        const h = harness()
        renderScreen(h)
        await readyToPlay()
        h.run(open(400, 300))
        expect(screen.getByTestId('game-status')).toHaveTextContent(/em qualquer ponto/i)
    })

    it('sem a mão à vista, orienta a mostrá-la inteira, com a palma para a câmera', async () => {
        renderScreen(harness())
        await readyToPlay()
        const status = screen.getByTestId('game-status')
        expect(status).toHaveTextContent(/palma/i)
        expect(status).toHaveTextContent(/altura do peito/i)
    })

    it('mostra o campo e a câmera lado a lado no mesmo layout', () => {
        const { container } = renderScreen(harness())
        const layout = container.querySelector('.marbles-layout')
        expect(layout).not.toBeNull()
        expect(layout?.querySelector('.marbles-field')).not.toBeNull()
        expect(layout?.querySelector('.camera-panel')).not.toBeNull()
    })

    it('desenha o cursor da mão no campo quando a mão aparece', async () => {
        const h = harness()
        renderScreen(h)
        await readyToPlay()
        arcSpy.mockClear()
        h.run(open(400, 300))
        const centers = (arcSpy.mock.calls as unknown as number[][]).map(([x, y]) => [
            Math.round(x),
            Math.round(y),
        ])
        expect(centers).toContainEqual([400, 300])
    })

    it('câmera negada explica que o jogo não começa sem câmera', async () => {
        const denied = vi.fn(() => Promise.reject(namedError('NotAllowedError')))
        renderScreen(harness(), denied)
        fireEvent.click(screen.getByRole('button', { name: /ativar câmera/i }))
        await waitFor(() => {
            expect(screen.getByTestId('game-status')).toHaveTextContent(/sem a câmera/i)
        })
    })

    it('falha do detector mostra um alerta com o motivo', async () => {
        const failing = vi.fn(() => Promise.reject(new Error('modelo ausente')))
        renderScreen(harness({ createTracker: failing }))
        fireEvent.click(screen.getByRole('button', { name: /ativar câmera/i }))
        const alert = await screen.findByRole('alert')
        expect(alert).toHaveTextContent('O detector de mão falhou: modelo ausente')
    })

    it('durante a mira mostra o aviso de tiro e desenha as bolinhas no campo', async () => {
        const h = harness()
        renderScreen(h)
        await readyToPlay()
        h.run(open(100, 300))
        h.run(closed(150, 300))
        h.run(closed(60, 300))
        expect(screen.getByTestId('game-status')).toHaveTextContent(/abra a pinça/i)
        expect(arcSpy).toHaveBeenCalled()
    })

    it('mostra o painel de depuração com delegate, estado, razão e pinça', async () => {
        const h = harness()
        renderScreen(h)
        await readyToPlay()
        h.run(closed(400, 100), 2)
        const panel = screen.getByRole('heading', { name: /depuração/i }).closest('section')
        expect(panel).not.toBeNull()
        const debug = within(panel as HTMLElement)
        expect(debug.getByText('Delegate')).toBeInTheDocument()
        expect(debug.getByText('GPU')).toBeInTheDocument()
        expect(debug.getByText('Razão da pinça')).toBeInTheDocument()
        expect(debug.getByText('Pinça fechada')).toBeInTheDocument()
        expect(debug.getByText('Mão visível')).toBeInTheDocument()
        expect(debug.getByText('Quadros processados')).toBeInTheDocument()
        expect(debug.getByText('Latência mediana')).toBeInTheDocument()
        expect(debug.getByText('Latência p95')).toBeInTheDocument()
    })

    it('depois de um tiro certeiro, anuncia o acerto e Nova rodada reinicia', async () => {
        const h = harness()
        renderScreen(h)
        await readyToPlay()
        h.run(open(100, 300))
        h.run(closed(150, 300))
        h.run(closed(20, 300), 2)
        h.run(open(20, 300))
        expect(screen.getByTestId('shot-counter')).toHaveTextContent('Tiros: 1')
        h.run(null, 120, 16)
        expect(screen.getByTestId('game-status')).toHaveTextContent('Acertou o alvo em 1 tiro!')

        fireEvent.click(screen.getByRole('button', { name: /nova rodada/i }))
        expect(screen.getByTestId('shot-counter')).toHaveTextContent('Tiros: 0')
        h.run(open(400, 300))
        expect(screen.getByTestId('game-status')).toHaveTextContent(/em qualquer ponto/i)
    })
})

describe('MarblesScreen: modo de tiro', () => {
    it('mostra o seletor com a pinça marcada e o estalo como alpha', () => {
        renderScreen(harness())
        const group = screen.getByRole('group', { name: /modo de tiro/i })
        expect(within(group).getByRole('radio', { name: /pinça/i })).toBeChecked()
        const flickRadio = within(group).getByRole('radio', { name: /estalo/i })
        expect(flickRadio).not.toBeChecked()
        expect(flickRadio.closest('label')).toHaveTextContent(/alpha/i)
    })

    it('?mode=estalo na URL começa no modo estalo', () => {
        window.history.pushState({}, '', '/marbles.html?mode=estalo')
        try {
            renderScreen(harness())
            expect(screen.getByRole('radio', { name: /estalo/i })).toBeChecked()
        } finally {
            window.history.pushState({}, '', '/')
        }
    })

    it('trocar para o estalo muda as mensagens e mostra as linhas do estalo na depuração', async () => {
        const h = harness()
        renderScreen(h)
        await readyToPlay()
        expect(screen.queryByText('Velocidade da abertura')).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('radio', { name: /estalo/i }))
        h.run(open(400, 300))
        expect(screen.getByTestId('game-status')).toHaveTextContent(/estalo \(alpha\)/i)
        expect(screen.getByTestId('game-status')).toHaveTextContent(
            /feche a pinça, arraste a mão para longe do alvo e abra os dedos rápido para atirar/i,
        )
        expect(screen.getByText('Armado')).toBeInTheDocument()
        expect(screen.getByText('Velocidade da abertura')).toBeInTheDocument()
        expect(screen.getByText('Duração da subida')).toBeInTheDocument()
        expect(screen.getByText('Resultado do último estalo')).toBeInTheDocument()
    })

    it('armado, orienta a arrastar e abrir os dedos rápido; com arrasto, o estalo rápido dispara', async () => {
        const h = harness()
        renderScreen(h)
        await readyToPlay()
        fireEvent.click(screen.getByRole('radio', { name: /estalo/i }))
        h.run(open(400, 300), 2, 16)
        h.run(closed(400, 300), 3, 16)
        expect(screen.getByTestId('game-status')).toHaveTextContent(/arraste.*mais.*curto/i)
        h.run(closed(300, 300), 2, 16)
        expect(screen.getByTestId('game-status')).toHaveTextContent(/abra os dedos rápido/i)
        h.run(pinchHand({ ratio: 0.9, x: 300, y: 300 }), 1, 16)
        expect(screen.getByTestId('shot-counter')).toHaveTextContent('Tiros: 1')
        expect(screen.getByText('disparado')).toBeInTheDocument()
    })

    it('abrir rápido sem arrasto mostra "sem tiro" na região aria-live e não conta tiro', async () => {
        const h = harness()
        renderScreen(h)
        await readyToPlay()
        fireEvent.click(screen.getByRole('radio', { name: /estalo/i }))
        h.run(open(400, 300), 2, 16)
        h.run(closed(400, 300), 3, 16)
        h.run(pinchHand({ ratio: 0.9, x: 400, y: 300 }), 1, 16)
        expect(screen.getByTestId('shot-counter')).toHaveTextContent('Tiros: 0')
        const result = screen.getByText('sem tiro')
        expect(result.closest('[aria-live]')).not.toBeNull()
    })

    it('mostra "Quadros novos da câmera/s" na depuração nos dois modos', async () => {
        const h = harness()
        renderScreen(h)
        await readyToPlay()
        expect(screen.getByText('Quadros novos da câmera/s')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('radio', { name: /estalo/i }))
        expect(screen.getByText('Quadros novos da câmera/s')).toBeInTheDocument()
    })

    it('voltar para a pinça reinicia a rodada', async () => {
        const h = harness()
        renderScreen(h)
        await readyToPlay()
        fireEvent.click(screen.getByRole('radio', { name: /estalo/i }))
        h.run(open(400, 300), 2, 16)
        h.run(closed(400, 300), 3, 16)
        h.run(closed(300, 300), 2, 16)
        h.run(pinchHand({ ratio: 0.9, x: 300, y: 300 }), 1, 16)
        expect(screen.getByTestId('shot-counter')).toHaveTextContent('Tiros: 1')
        fireEvent.click(screen.getByRole('radio', { name: /pinça/i }))
        expect(screen.getByTestId('shot-counter')).toHaveTextContent('Tiros: 0')
        expect(screen.queryByText('Velocidade da abertura')).not.toBeInTheDocument()
    })
})

