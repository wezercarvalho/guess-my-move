import { type City } from '@guess-my-move/swing'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { type SwingRenderer } from './cityRenderer.js'
import { SwingScreen } from './SwingScreen.js'
import { type SwingDeps } from './useSwingGame.js'

/** Prédio alto 40 m à frente do ponto de partida. */
const city: City = {
    version: 1,
    name: 'teste',
    attribution: 'Dados do mapa © colaboradores do OpenStreetMap (ODbL)',
    bounds: { minX: -200, maxX: 200, minZ: -200, maxZ: 200 },
    buildings: [{ height: 300, ring: [-10, -50, 10, -50, 10, -40, -10, -40] }],
    roads: [],
}

beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})

afterEach(() => {
    vi.restoreAllMocks()
})

function harness(overrides: SwingDeps = {}) {
    let nowMs = 1000
    let queued: (() => void) | null = null
    const keys = new EventTarget()
    const renderer: SwingRenderer = { resize: vi.fn(), render: vi.fn(), dispose: vi.fn() }
    const deps: SwingDeps = {
        loadCity: () => Promise.resolve(city),
        createRenderer: () => renderer,
        now: () => nowMs,
        requestFrame: (callback) => {
            queued = callback
            return 1
        },
        cancelFrame: () => {
            queued = null
        },
        keys,
        ...overrides,
    }
    return {
        deps,
        press: (key: string) => keys.dispatchEvent(new KeyboardEvent('keydown', { key })),
        run(count = 1, stepMs = 16) {
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

async function openGame(h = harness()) {
    render(<SwingScreen cameraGetUserMedia={null} deps={h.deps} />)
    await waitFor(() => {
        expect(screen.getByTestId('game-status')).toHaveTextContent(/pose de teia/i)
    })
    return h
}

describe('SwingScreen', () => {
    it('mostra o título, a frase de apoio e o crédito do mapa', async () => {
        await openGame()
        expect(screen.getByRole('heading', { level: 1, name: 'Arranha-Teia' })).toBeInTheDocument()
        expect(screen.getByText(/balance entre os prédios de midtown/i)).toBeInTheDocument()
        expect(screen.getByTestId('map-credit')).toHaveTextContent(/OpenStreetMap \(ODbL\)/)
    })

    it('começa com o status de carregamento da cidade', () => {
        render(
            <SwingScreen
                cameraGetUserMedia={null}
                deps={harness({ loadCity: () => new Promise(() => undefined) }).deps}
            />,
        )
        expect(screen.getByTestId('game-status')).toHaveTextContent(/carregando a cidade/i)
    })

    it('Espaço lança a teia: contador, status e etapa do guia mudam', async () => {
        const h = await openGame()
        h.run(2)
        h.press(' ')
        h.run(3)
        h.run(1, 150)
        await waitFor(() => {
            expect(screen.getByTestId('web-counter')).toHaveTextContent('Teias: 1')
        })
        expect(screen.getByTestId('game-status')).toHaveTextContent(/balançando/i)
        const guide = screen.getByRole('list', { name: /como jogar/i })
        const current = within(guide).getAllByRole('listitem').find((item) => item.getAttribute('aria-current') === 'step')
        expect(current).toHaveTextContent(/punho fechado puxa/i)
        expect(screen.getByTestId('hud-web')).toHaveTextContent(/centro|esquerda|direita/)
    })

    it('Z lança à esquerda e o medidor mostra a mão da teia', async () => {
        const h = await openGame()
        h.run(2)
        h.press('z')
        h.run(3)
        h.run(1, 150)
        await waitFor(() => {
            expect(screen.getByTestId('hud-web')).toHaveTextContent('esquerda')
        })
    })

    it('sem teia o medidor diz solta', async () => {
        await openGame()
        expect(screen.getByTestId('hud-web')).toHaveTextContent('solta')
    })

    it('mostra velocidade e altura do jogador', async () => {
        const h = await openGame()
        h.run(2)
        h.run(1, 150)
        await waitFor(() => {
            expect(screen.getByTestId('hud-altitude')).toHaveTextContent(/^\d+ m$/)
        })
        expect(screen.getByTestId('hud-speed')).toHaveTextContent(/^\d+ km\/h$/)
        expect(screen.getByTestId('hud-altitude')).not.toHaveTextContent(/^0 m$/)
    })

    it('a depuração das mãos começa recolhida e abre com o botão', async () => {
        await openGame()
        const toggle = screen.getByRole('button', { name: 'Depuração' })
        expect(toggle).toHaveAttribute('aria-expanded', 'false')
        expect(screen.queryByRole('region', { name: 'Depuração' })).not.toBeInTheDocument()
        fireEvent.click(toggle)
        expect(toggle).toHaveAttribute('aria-expanded', 'true')
        expect(screen.getByRole('region', { name: 'Depuração' })).toHaveTextContent(/Nenhuma mão/i)
    })

    it('sem câmera, a dica manda usar o teclado', async () => {
        await openGame()
        expect(screen.getByTestId('guide-hint')).toHaveTextContent(/Sem câmera.*Z e X/i)
    })

    it('Voltar ao início zera o contador de teias', async () => {
        const h = await openGame()
        h.run(2)
        h.press(' ')
        h.run(3)
        h.run(1, 150)
        await waitFor(() => {
            expect(screen.getByTestId('web-counter')).toHaveTextContent('Teias: 1')
        })
        fireEvent.click(screen.getByRole('button', { name: /voltar ao início/i }))
        expect(screen.getByTestId('web-counter')).toHaveTextContent('Teias: 0')
    })

    it('mostra o motivo quando a cidade não carrega e bloqueia o botão', async () => {
        render(
            <SwingScreen
                cameraGetUserMedia={null}
                deps={harness({ loadCity: () => Promise.reject(new Error('HTTP 404')) }).deps}
            />,
        )
        expect(await screen.findByRole('alert')).toHaveTextContent(/HTTP 404/)
        expect(screen.getByRole('button', { name: /voltar ao início/i })).toBeDisabled()
    })

    it('avisa que a câmera é processada no navegador', async () => {
        await openGame()
        expect(screen.getByRole('note')).toHaveTextContent(/nada é enviado/i)
    })
})
