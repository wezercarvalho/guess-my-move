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
        expect(screen.getByTestId('game-status')).toHaveTextContent(/mostre a mão inteira/i)
    })
}

const open = (x: number, y: number) => pinchHand({ ratio: OPEN_RATIO, x, y })
const closed = (x: number, y: number) => pinchHand({ ratio: CLOSED_RATIO, x, y })

describe('MarblesScreen', () => {
    it('mostra o título, o aviso de privacidade, o campo, o contador e o botão de depuração, sem marca', () => {
        renderScreen(harness())
        expect(screen.queryByText(/intersect/i)).not.toBeInTheDocument()
        expect(screen.getByRole('heading', { name: /bolinhas de gude/i })).toBeInTheDocument()
        expect(screen.getByRole('note')).toHaveTextContent(/nada é enviado/i)
        expect(screen.getByLabelText(/campo do jogo/i)).toBeInTheDocument()
        expect(screen.getByTestId('shot-counter')).toHaveTextContent('Tiros: 0')
        expect(screen.getByRole('button', { name: /depuração/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /ativar câmera/i })).toBeInTheDocument()
    })

    it('a depuração começa recolhida e abre e fecha pelo botão, com o estado anunciado', () => {
        renderScreen(harness())
        const toggle = screen.getByRole('button', { name: /depuração/i })
        expect(toggle).toHaveAttribute('aria-expanded', 'false')
        expect(screen.queryByRole('heading', { name: /depuração/i })).not.toBeInTheDocument()

        fireEvent.click(toggle)
        expect(toggle).toHaveAttribute('aria-expanded', 'true')
        expect(screen.getByRole('heading', { name: /depuração/i })).toBeInTheDocument()
        const panelId = toggle.getAttribute('aria-controls') ?? ''
        expect(document.getElementById(panelId)).toContainElement(
            screen.getByRole('heading', { name: /depuração/i }),
        )

        fireEvent.click(toggle)
        expect(toggle).toHaveAttribute('aria-expanded', 'false')
        expect(screen.queryByRole('heading', { name: /depuração/i })).not.toBeInTheDocument()
    })

    it('o modo de tiro é um controle segmentado dentro da barra do campo', () => {
        renderScreen(harness())
        const group = screen.getByRole('group', { name: /modo de tiro/i })
        expect(group.closest('.marbles-toolbar')).not.toBeNull()
    })

    it('antes da câmera, orienta a ativá-la', () => {
        renderScreen(harness())
        expect(screen.getByTestId('game-status')).toHaveTextContent(/ative a câmera/i)
    })

    it('anuncia o estado em uma região aria-live educada', () => {
        renderScreen(harness())
        expect(screen.getByTestId('game-status')).toHaveAttribute('aria-live', 'polite')
    })

    it('com a mão à vista, o status é uma linha curta com a próxima ação', async () => {
        const h = harness()
        renderScreen(h)
        await readyToPlay()
        h.run(open(400, 300))
        expect(screen.getByTestId('game-status')).toHaveTextContent('Mão à vista. Feche a pinça.')
    })

    it('sem a mão à vista, o status pede a mão e a dica orienta a posição', async () => {
        renderScreen(harness())
        await readyToPlay()
        expect(screen.getByTestId('game-status')).toHaveTextContent('Mostre a mão inteira para a câmera.')
        expect(screen.getByTestId('guide-hint')).toHaveTextContent(/palma para a câmera.*altura do peito.*boa luz/i)
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
            expect(screen.getByTestId('game-status')).toHaveTextContent(/sem câmera não há jogo/i)
        })
    })

    it('falha do detector mostra um alerta com o motivo', async () => {
        const failing = vi.fn(() => Promise.reject(new Error('modelo ausente')))
        renderScreen(harness({ createTracker: failing }))
        fireEvent.click(screen.getByRole('button', { name: /ativar câmera/i }))
        const alert = await screen.findByRole('alert')
        expect(alert).toHaveTextContent('Motivo: modelo ausente')
    })

    it('durante a mira mostra o aviso de tiro e desenha as bolinhas no campo', async () => {
        const h = harness()
        renderScreen(h)
        await readyToPlay()
        h.run(open(100, 300))
        h.run(closed(150, 300))
        h.run(closed(60, 300))
        expect(screen.getByTestId('game-status')).toHaveTextContent('Mira pronta. Abra os dedos.')
        expect(arcSpy).toHaveBeenCalled()
    })

    it('mostra o painel de depuração com delegate, estado, razão e pinça', async () => {
        const h = harness()
        renderScreen(h)
        await readyToPlay()
        h.run(closed(400, 100), 2)
        fireEvent.click(screen.getByRole('button', { name: /depuração/i }))
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
        expect(screen.getByTestId('game-status')).toHaveTextContent('Acertou em 1 tiro!')

        fireEvent.click(screen.getByRole('button', { name: /nova rodada/i }))
        expect(screen.getByTestId('shot-counter')).toHaveTextContent('Tiros: 0')
        h.run(open(400, 300))
        expect(screen.getByTestId('game-status')).toHaveTextContent('Mão à vista. Feche a pinça.')
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
        h.run(pinchHand({ ratio: 1.5, x: 320, y: 300 }))
        expect(screen.getByTestId('game-status')).toHaveTextContent('Mão à vista. Feche a mão.')
        expect(screen.getByText('Armado')).toBeInTheDocument()
        expect(screen.getByText('Velocidade da abertura')).toBeInTheDocument()
        expect(screen.getByText('Duração da subida')).toBeInTheDocument()
        expect(screen.getByText('Força do último estalo')).toBeInTheDocument()
        expect(screen.getByText('Resultado do último estalo')).toBeInTheDocument()
    })

    it('mostra "Quadros novos da câmera/s" na depuração nos dois modos', async () => {
        const h = harness()
        renderScreen(h)
        await readyToPlay()
        expect(screen.getByText('Quadros novos da câmera/s')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('radio', { name: /estalo/i }))
        expect(screen.getByText('Quadros novos da câmera/s')).toBeInTheDocument()
    })

    it('a pinça não mostra força nem velocidade de abertura: essas linhas são só do estalo', async () => {
        const h = harness()
        renderScreen(h)
        await readyToPlay()
        expect(screen.queryByText('Força do último estalo')).not.toBeInTheDocument()
        expect(screen.queryByText('Velocidade da abertura')).not.toBeInTheDocument()
    })

    it('armado, orienta a afastar a mão do alvo e esticar o polegar; o polegar esticado e mantido dispara', async () => {
        const h = harness()
        renderScreen(h)
        await readyToPlay()
        fireEvent.click(screen.getByRole('radio', { name: /estalo/i }))
        h.run(pinchHand({ ratio: 0.8, x: 400, y: 300 }), 2, 67)
        h.run(pinchHand({ ratio: 0.8, x: 320, y: 300 }), 2, 67)
        expect(screen.getByTestId('game-status')).toHaveTextContent('Armado. Mire e estique o polegar.')
        h.run(pinchHand({ ratio: 1.5, x: 320, y: 300 }), 3, 67)
        expect(screen.getByTestId('shot-counter')).toHaveTextContent('Tiros: 1')
        expect(screen.getByText('disparado')).toBeInTheDocument()
        expect(screen.getByText('Força do último estalo').nextElementSibling).toHaveTextContent(/%/)
        expect(screen.getByText('disparado').closest('[aria-live]')).not.toBeNull()
    })

    it('o guia "Como jogar" existe nos dois modos e, no estalo, acompanha o movimento', async () => {
        const h = harness()
        renderScreen(h)
        await readyToPlay()
        const pinchItems = within(screen.getByRole('list', { name: /como jogar/i })).getAllByRole('listitem')
        expect(pinchItems[0]).toHaveTextContent(/feche a pinça/i)

        fireEvent.click(screen.getByRole('radio', { name: /estalo/i }))
        const list = screen.getByRole('list', { name: /como jogar/i })
        expect(within(list).getAllByRole('listitem')).toHaveLength(3)
        const current = () =>
            within(list)
                .getAllByRole('listitem')
                .findIndex((item) => item.getAttribute('aria-current') === 'step')
        expect(current()).toBe(0)

        h.run(pinchHand({ ratio: 0.8, x: 400, y: 300 }), 2, 67)
        h.run(pinchHand({ ratio: 0.8, x: 320, y: 300 }), 2, 67)
        expect(current()).toBe(1)
        h.run(pinchHand({ ratio: 1.5, x: 320, y: 300 }), 1, 67)
        expect(current()).toBe(2)
        h.run(pinchHand({ ratio: 1.5, x: 320, y: 300 }), 2, 67)
        // O tiro saiu: a bolinha rola e nenhuma etapa fica destacada.
        expect(screen.getByTestId('game-status')).toHaveTextContent('Bolinha rolando…')
        expect(current()).toBe(-1)
    })

    it('mostra o gesto reconhecido na depuração e a dica quando o estalo é não sustentado', async () => {
        const h = harness()
        renderScreen(h)
        await readyToPlay()
        fireEvent.click(screen.getByRole('radio', { name: /estalo/i }))
        h.run({ ...pinchHand({ ratio: 0.8, x: 400, y: 300 }), gesture: { name: 'Closed_Fist', score: 0.84 } }, 3, 67)
        expect(screen.getByText('Gesto reconhecido').nextElementSibling).toHaveTextContent(
            'Closed_Fist (84%)',
        )
        h.run(pinchHand({ ratio: 1.5, x: 320, y: 300 }), 1, 67)
        h.run(pinchHand({ ratio: 0.8, x: 400, y: 300 }), 1, 67)
        expect(screen.getByTestId('guide-hint')).toHaveTextContent(/segure o polegar esticado/i)
    })

    it('voltar para a pinça reinicia a rodada', async () => {
        const h = harness()
        renderScreen(h)
        await readyToPlay()
        fireEvent.click(screen.getByRole('radio', { name: /estalo/i }))
        h.run(pinchHand({ ratio: 0.8, x: 400, y: 300 }), 2, 67)
        h.run(pinchHand({ ratio: 0.8, x: 320, y: 300 }), 2, 67)
        h.run(pinchHand({ ratio: 1.5, x: 320, y: 300 }), 3, 67)
        fireEvent.click(screen.getByRole('radio', { name: /pinça/i }))
        expect(screen.getByTestId('shot-counter')).toHaveTextContent('Tiros: 0')
        expect(screen.queryByText('Velocidade da abertura')).not.toBeInTheDocument()
    })
})

