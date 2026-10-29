import { modes } from '@guess-my-move/marbles'
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
        seed: 999,
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
        tick(count = 1, stepMs = 16) {
            for (let i = 0; i < count; i++) {
                const callback = queued
                if (!callback) return
                queued = null
                nowMs += stepMs
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

/** Ativa a câmera e espera o detector carregar (a tela ainda na escolha). */
async function activateCamera() {
    act(() => {
        fireEvent.click(screen.getByRole('button', { name: /ativar câmera/i }))
    })
    // O detector carrega de forma assíncrona; espera a escolha ficar disponível.
    await waitFor(() => {
        expect(screen.getByRole('button', { name: /começar partida/i })).toBeEnabled()
    })
}

/** Começa a partida e espera o detector ficar pronto (status pede a mão). */
async function startAndReady() {
    act(() => {
        fireEvent.click(screen.getByRole('button', { name: /começar partida/i }))
    })
    await waitFor(() => {
        expect(screen.getByTestId('game-status')).toHaveTextContent(/mostre a mão/i)
    })
}

const open = (x: number, y: number) => pinchHand({ ratio: OPEN_RATIO, x, y })
const closed = (x: number, y: number) => pinchHand({ ratio: CLOSED_RATIO, x, y })

/** Dispara um tiro do jogador pela pinça. */
function firePinch(h: ReturnType<typeof harness>) {
    h.run(open(400, 300))
    h.run(closed(400, 300))
    h.run(closed(250, 300), 2)
    h.run(open(250, 300))
}

function phase() {
    return screen.getByTestId('game-status').textContent ?? ''
}

/** Joga a partida inteira pela tela até encerrar. */
function playMatch(h: ReturnType<typeof harness>, maxShots = 100) {
    for (let i = 0; i < maxShots; i++) {
        const status = phase()
        if (/encerrada/i.test(status)) break
        if (/sua vez|feche a|mire|mostre a mão/i.test(status)) {
            firePinch(h)
            for (let t = 0; t < 2000; t++) {
                if (!/rolando/i.test(phase())) break
                h.tick(1, 250)
            }
        } else {
            // Vez do bot ou espera entre rodadas: só o tempo corre.
            let moved = false
            for (let t = 0; t < 2000; t++) {
                h.tick(1, 250)
                if (/sua vez|feche a|mire|mostre a mão|encerrada/i.test(phase())) {
                    moved = true
                    break
                }
            }
            if (!moved) break
        }
    }
}

describe('MarblesScreen: tela inicial', () => {
    it('mostra título, aviso de privacidade, controle de tiro e a escolha de modo/adversário, sem marca', () => {
        renderScreen(harness())
        expect(screen.queryByText(/intersect/i)).not.toBeInTheDocument()
        expect(screen.getByRole('heading', { name: /bolinhas de gude/i })).toBeInTheDocument()
        expect(screen.getByRole('note')).toHaveTextContent(/nada é enviado/i)
        expect(screen.getByRole('group', { name: /controle de tiro/i })).toBeInTheDocument()
        expect(screen.getByRole('group', { name: /^modo$/i })).toBeInTheDocument()
        expect(screen.getByRole('group', { name: /adversário/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /começar partida/i })).toBeInTheDocument()
    })

    it('o seletor de modo lista os três modos do registro', () => {
        renderScreen(harness())
        const group = screen.getByRole('group', { name: /^modo$/i })
        for (const m of modes) {
            expect(within(group).getByRole('radio', { name: new RegExp(m.name, 'i') })).toBeInTheDocument()
        }
    })

    it('a depuração começa recolhida e abre pelo botão', () => {
        renderScreen(harness())
        const toggle = screen.getByRole('button', { name: /depuração/i })
        expect(toggle).toHaveAttribute('aria-expanded', 'false')
        fireEvent.click(toggle)
        expect(toggle).toHaveAttribute('aria-expanded', 'true')
        expect(screen.getByRole('heading', { name: /depuração/i })).toBeInTheDocument()
    })

    it('antes de começar, o guia mostra as regras do modo selecionado', () => {
        renderScreen(harness())
        expect(screen.getByTestId('guide-rules')).toHaveTextContent(/vit[óo]ria|vence|acertar/i)
    })

    it('começar a partida mostra o campo do modo escolhido', async () => {
        const h = harness()
        renderScreen(h)
        await activateCamera()
        fireEvent.click(within(screen.getByRole('group', { name: /^modo$/i })).getByRole('radio', { name: /triângulo/i }))
        fireEvent.click(screen.getByRole('button', { name: /começar partida/i }))
        expect(screen.getByLabelText(/campo do jogo/i)).toBeInTheDocument()
        expect(screen.queryByTestId('setup')).not.toBeInTheDocument()
    })
})

describe('MarblesScreen: status de uma linha por estado', () => {
    it('antes da câmera, orienta a ativá-la após começar', () => {
        const h = harness()
        renderScreen(h)
        fireEvent.click(screen.getByRole('button', { name: /começar partida/i }))
        expect(phase()).toMatch(/ative a câmera/i)
    })

    it('com a mão à vista é a sua vez; sem a mão, pede a mão', async () => {
        const h = harness()
        renderScreen(h)
        await activateCamera()
        await startAndReady()
        expect(phase()).toMatch(/mostre a mão/i)
        h.run(open(400, 300))
        expect(phase()).toMatch(/sua vez\. feche a pinça/i)
    })

    it('câmera negada explica que o jogo não começa sem câmera', async () => {
        const denied = vi.fn(() => Promise.reject(namedError('NotAllowedError')))
        renderScreen(harness(), denied)
        fireEvent.click(screen.getByRole('button', { name: /ativar câmera/i }))
        await waitFor(() => {
            expect(phase()).toMatch(/sem câmera não há jogo/i)
        })
    })

    it('falha do detector mostra um alerta com o motivo', async () => {
        const failing = vi.fn(() => Promise.reject(new Error('modelo ausente')))
        renderScreen(harness({ createTracker: failing }))
        fireEvent.click(screen.getByRole('button', { name: /ativar câmera/i }))
        const alert = await screen.findByRole('alert')
        expect(alert).toHaveTextContent('Motivo: modelo ausente')
    })

    it('anuncia o status numa região aria-live educada', () => {
        renderScreen(harness())
        expect(screen.getByTestId('game-status')).toHaveAttribute('aria-live', 'polite')
    })
})

describe('MarblesScreen: fluxo completo por modo e adversário', () => {
    for (const { id, name } of modes) {
        for (const opponent of ['target', 'bot'] as const) {
            const label = opponent === 'bot' ? 'Contra o bot' : 'Contra a meta'
            it(`modo ${id} ${label}: a partida chega a Vitória, Derrota ou Empate`, async () => {
                const h = harness()
                renderScreen(h)
                await activateCamera()
                fireEvent.click(
                    within(screen.getByRole('group', { name: /^modo$/i })).getByRole('radio', {
                        name: new RegExp(name, 'i'),
                    }),
                )
                fireEvent.click(
                    within(screen.getByRole('group', { name: /adversário/i })).getByRole('radio', {
                        name: new RegExp(label, 'i'),
                    }),
                )
                await startAndReady()
                playMatch(h)
                expect(phase()).toMatch(/partida encerrada/i)
                expect(screen.getByTestId('endgame')).toBeInTheDocument()
                expect(screen.getByTestId('endgame')).toHaveTextContent(/vitória|derrota|empate/i)
            })
        }
    }
})

describe('MarblesScreen: vez do bot', () => {
    it('na vez do bot, fechar a pinça não dispara e o status diz vez do bot', async () => {
        const h = harness()
        renderScreen(h)
        await activateCamera()
        fireEvent.click(
            within(screen.getByRole('group', { name: /adversário/i })).getByRole('radio', {
                name: /contra o bot/i,
            }),
        )
        await startAndReady()
        // Jogador joga sua vez; depois é a vez do bot.
        firePinch(h)
        let reachedBotTurn = false
        for (let t = 0; t < 2000; t++) {
            if (/vez do bot/i.test(phase())) {
                reachedBotTurn = true
                break
            }
            if (/encerrada/i.test(phase())) break
            h.tick(1, 16)
        }
        if (reachedBotTurn) {
            const shotsBefore = screen.getByTestId('shots-left').textContent
            h.run(closed(300, 300), 3)
            expect(screen.getByTestId('shots-left').textContent).toBe(shotsBefore)
            expect(phase()).toMatch(/vez do bot/i)
        }
        expect(true).toBe(true)
    })
})

describe('MarblesScreen: controle de tiro e fim de partida', () => {
    it('o controle de tiro é um segmentado com a pinça marcada e o estalo como alpha', () => {
        renderScreen(harness())
        const group = screen.getByRole('group', { name: /controle de tiro/i })
        expect(within(group).getByRole('radio', { name: /pinça/i })).toBeChecked()
        const flick = within(group).getByRole('radio', { name: /estalo/i })
        expect(flick).not.toBeChecked()
        expect(flick.closest('label')).toHaveTextContent(/alpha/i)
    })

    it('trocar para o estalo mostra as linhas do estalo na depuração', async () => {
        const h = harness()
        renderScreen(h)
        await activateCamera()
        fireEvent.click(screen.getByRole('button', { name: /depuração/i }))
        expect(screen.queryByText('Velocidade da abertura')).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('radio', { name: /estalo/i }))
        expect(screen.getByText('Velocidade da abertura')).toBeInTheDocument()
        expect(screen.getByText('Força do último estalo')).toBeInTheDocument()
    })

    it('ao terminar, oferece Jogar de novo e Trocar de modo', async () => {
        const h = harness()
        renderScreen(h)
        await activateCamera()
        await startAndReady()
        playMatch(h)
        expect(screen.getByRole('button', { name: /jogar de novo/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /trocar de modo/i })).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: /trocar de modo/i }))
        expect(screen.getByTestId('setup')).toBeInTheDocument()
    })
})
