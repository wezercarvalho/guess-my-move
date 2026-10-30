import { DEFAULT_PLACEMENT, type PlannedNote } from '@guess-my-move/guitar'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { type AudioPlayer, type AudioStatus } from './audioPlayer.js'
import { EM, fretHand, smooth, strumHand } from '../test-utils/fakeGuitarHands.js'
import { createFakeStream, namedError } from '../test-utils/fakeMedia.js'
import { type HandTracker, type TrackedHand } from '../tracker/handTracker.js'
import { GuitarScreen } from './GuitarScreen.js'
import { type GuitarDeps } from './useGuitarGame.js'

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
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})

afterEach(() => {
    vi.restoreAllMocks()
})

function fakeAudio(initial: AudioStatus) {
    const plays: PlannedNote[][] = []
    let status = initial
    const listeners = new Set<() => void>()
    const unlock = vi.fn(() => {
        status = 'running'
        for (const listener of listeners) listener()
        return Promise.resolve()
    })
    const player: AudioPlayer = {
        get status() {
            return status
        },
        unlock,
        play: (plan) => {
            if (status !== 'running') return false
            plays.push([...plan])
            return true
        },
        latency: () => ({ base: 0.01, output: 0.04 }),
        subscribe: (listener) => {
            listeners.add(listener)
            return () => {
                listeners.delete(listener)
            }
        },
        dispose: () => undefined,
    }
    return { player, plays, unlock }
}

function harness(audioStatus: AudioStatus = 'running') {
    let nowMs = 1000
    let queued: (() => void) | null = null
    const keys = new EventTarget()
    const state: { hands: TrackedHand[] } = { hands: [] }
    const tracker: HandTracker = {
        delegate: 'GPU',
        detect: () => state.hands[0] ?? null,
        detectAll: () => state.hands,
        close: () => undefined,
    }
    const audio = fakeAudio(audioStatus)
    const deps: GuitarDeps = {
        createTracker: () => Promise.resolve(tracker),
        createAudio: () => audio.player,
        requestFrame: (callback) => {
            queued = callback
            return 1
        },
        cancelFrame: () => {
            queued = null
        },
        now: () => nowMs,
        keys,
    }
    return {
        deps,
        audio,
        press: (key: string) => keys.dispatchEvent(new KeyboardEvent('keydown', { key })),
        setHands(hands: TrackedHand[]) {
            state.hands = hands
        },
        run(count = 1, stepMs = 33) {
            for (let i = 0; i < count; i++) {
                const callback = queued
                if (!callback) return
                queued = null
                nowMs += stepMs
                media.currentTime += stepMs / 1000
                act(() => {
                    callback()
                })
            }
        },
    }
}

const status = () => screen.getByTestId('game-status')

async function openWithCamera(h = harness()) {
    render(<GuitarScreen cameraGetUserMedia={() => Promise.resolve(createFakeStream().stream)} deps={h.deps} />)
    fireEvent.click(screen.getByRole('button', { name: /ativar câmera/i }))
    await waitFor(() => {
        expect(screen.getByTestId('camera-active-indicator')).toBeInTheDocument()
    })
    // o rastreador falso é entregue por uma promessa resolvida
    await act(async () => {
        await Promise.resolve()
    })
    return h
}

describe('GuitarScreen', () => {
    it('mostra o título, a frase de apoio e não repete a palavra Alpha', () => {
        render(<GuitarScreen cameraGetUserMedia={null} deps={harness().deps} />)
        expect(screen.getByRole('heading', { level: 1, name: 'Violão no Ar' })).toBeInTheDocument()
        expect(screen.getByText(/forme o acorde com uma mão e bata com a outra/i)).toBeInTheDocument()
        expect(screen.queryByText(/alpha/i)).not.toBeInTheDocument()
    })

    it('sem câmera, o status de uma linha manda ativar a câmera ou usar o Espaço', () => {
        render(<GuitarScreen cameraGetUserMedia={null} deps={harness().deps} />)
        expect(status()).toHaveTextContent('Ative a câmera ou use Espaço para tocar.')
        expect(screen.getByTestId('guide-hint')).toHaveTextContent(/espaço/i)
    })

    it('avisa que a câmera é processada no navegador, com a frase única das outras telas', () => {
        render(<GuitarScreen cameraGetUserMedia={null} deps={harness().deps} />)
        const notes = screen.getAllByRole('note')
        expect(notes.some((note) => /nada é enviado nem gravado/i.test(note.textContent ?? ''))).toBe(true)
    })

    it('começa com o Em, o diagrama com descrição em texto e os cinco acordes para escolher', () => {
        render(<GuitarScreen cameraGetUserMedia={null} deps={harness().deps} />)
        expect(screen.getByRole('radio', { name: 'Em' })).toBeChecked()
        expect(screen.getAllByRole('radio').map((radio) => radio.closest('label')?.textContent)).toEqual([
            'Em',
            'Am',
            'D',
            'C',
            'G',
            'Esquerda',
            'Direita',
        ])
        expect(screen.getByRole('img', { name: /diagrama do em \(mi menor\)/i })).toBeInTheDocument()
    })

    it('escolher outro acorde troca o diagrama', () => {
        render(<GuitarScreen cameraGetUserMedia={null} deps={harness().deps} />)
        fireEvent.click(screen.getByRole('radio', { name: 'G' }))
        expect(screen.getByRole('img', { name: /diagrama do g \(sol maior\)/i })).toBeInTheDocument()
        expect(screen.getByRole('radio', { name: 'G' })).toBeChecked()
    })

    it('o guia tem três etapas em lista ordenada, sem etapa atual antes da câmera', () => {
        render(<GuitarScreen cameraGetUserMedia={null} deps={harness().deps} />)
        const guide = screen.getByRole('list', { name: /como jogar/i })
        const items = within(guide).getAllByRole('listitem')
        expect(items).toHaveLength(3)
        expect(items.some((item) => item.getAttribute('aria-current') === 'step')).toBe(false)
    })

    it('com a câmera e sem a mão do braço, o status diz qual mão mostrar e a etapa 1 fica atual', async () => {
        await openWithCamera()
        expect(status()).toHaveTextContent(/mostre a mão esquerda no braço/i)
        const items = within(screen.getByRole('list', { name: /como jogar/i })).getAllByRole('listitem')
        expect(items[0]).toHaveAttribute('aria-current', 'step')
    })

    it('no modo canhoto, o status pede a mão direita', async () => {
        await openWithCamera()
        fireEvent.click(screen.getByRole('radio', { name: 'Direita' }))
        expect(status()).toHaveTextContent(/mostre a mão direita no braço/i)
    })

    it('teste de fumaça: câmera, acorde certo, batida e som, e o acorde fica concluído', async () => {
        const h = await openWithCamera()
        const fret = fretHand(EM)
        h.setHands([fret, strumHand(0.35)])
        h.run(14)
        expect(status()).toHaveTextContent('Bata com a outra mão.')
        expect(screen.getByTestId('guide-hint')).toHaveTextContent(/desça a mão/i)

        for (let i = 1; i <= 6; i++) {
            h.setHands([fret, strumHand(0.35 + 0.25 * smooth(i / 6))])
            h.run()
        }
        h.setHands([fret, strumHand(0.6)])
        h.run(4)

        expect(h.audio.plays).toHaveLength(1)
        expect(h.audio.plays[0]?.map((note) => note.string)).toEqual([6, 5, 4, 3, 2, 1])
        expect(status()).toHaveTextContent('Em concluído. Próximo: Am.')
        expect(screen.getByRole('radio', { name: 'Em ✓' })).toBeInTheDocument()
    })

    it('com um dedo faltando, o status mostra uma única correção em português', async () => {
        const h = await openWithCamera()
        h.setHands([fretHand([{ string: 5, fret: 2 }]), strumHand(0.45)])
        h.run(14)
        expect(status()).toHaveTextContent('Coloque o dedo 3 na corda 4, casa 2.')
        expect(status().textContent).not.toMatch(/\n/)
    })

    it('câmera negada: explica em português e o teclado continua tocando o acorde alvo', async () => {
        const h = harness()
        render(
            <GuitarScreen
                cameraGetUserMedia={() => Promise.reject(namedError('NotAllowedError'))}
                deps={h.deps}
            />,
        )
        fireEvent.click(screen.getByRole('button', { name: /ativar câmera/i }))
        expect(await screen.findByRole('alert')).toHaveTextContent(/permiss/i)
        h.press(' ')
        expect(h.audio.plays).toHaveLength(1)
        expect(h.audio.plays[0]?.map((note) => note.string)).toEqual([6, 5, 4, 3, 2, 1])
    })

    it('os botões de bater tocam para baixo e para cima', () => {
        const h = harness()
        render(<GuitarScreen cameraGetUserMedia={null} deps={h.deps} />)
        fireEvent.click(screen.getByRole('button', { name: /bater para baixo/i }))
        fireEvent.click(screen.getByRole('button', { name: /bater para cima/i }))
        expect(h.audio.plays.map((plan) => plan[0]?.string)).toEqual([6, 1])
    })

    it('com o áudio bloqueado, avisa e o primeiro gesto o libera', async () => {
        const h = harness('idle')
        render(<GuitarScreen cameraGetUserMedia={null} deps={h.deps} />)
        expect(screen.getByTestId('audio-notice')).toHaveTextContent(/som desligado/i)
        fireEvent.pointerDown(window)
        await waitFor(() => {
            expect(screen.queryByTestId('audio-notice')).not.toBeInTheDocument()
        })
        expect(h.audio.unlock).toHaveBeenCalled()
    })

    it('a gaveta de depuração começa recolhida e mostra os números ao abrir', async () => {
        const h = await openWithCamera()
        h.setHands([fretHand(EM), strumHand(0.45)])
        h.run(14)
        const toggle = screen.getByRole('button', { name: 'Depuração' })
        expect(toggle).toHaveAttribute('aria-expanded', 'false')
        expect(screen.queryByRole('region', { name: 'Depuração' })).not.toBeInTheDocument()
        fireEvent.click(toggle)
        expect(toggle).toHaveAttribute('aria-expanded', 'true')
        const panel = screen.getByRole('region', { name: 'Depuração' })
        expect(panel).toHaveTextContent(/mãos à vista/i)
        expect(panel).toHaveTextContent('GPU')
        expect(panel).toHaveTextContent(/velocidade da batida/i)
        expect(panel).toHaveTextContent(/latência de saída do áudio/i)
        expect(panel).toHaveTextContent(/dedo 1.*corda 5, casa 2 \(apertando\)/i)
        expect(panel).toHaveTextContent(/corda 5.*ok, casa 2/i)
    })

    it('a latência desconhecida (o navegador informa 0) aparece como traço, não como 0 ms', () => {
        const h = harness()
        const deps: GuitarDeps = {
            ...h.deps,
            createAudio: () => ({
                ...h.audio.player,
                latency: () => ({ base: 0.01, output: 0 }),
            }),
        }
        render(<GuitarScreen cameraGetUserMedia={null} deps={deps} />)
        fireEvent.click(screen.getByRole('button', { name: 'Depuração' }))
        const panel = screen.getByRole('region', { name: 'Depuração' })
        expect(panel).toHaveTextContent('— (base 10 ms)')
        expect(panel).not.toHaveTextContent('0 ms (base')
    })

    it('o ajuste do braço move a posição e o botão restaura o padrão', () => {
        render(<GuitarScreen cameraGetUserMedia={null} deps={harness().deps} />)
        fireEvent.click(screen.getByRole('button', { name: 'Depuração' }))
        const slider = screen.getByLabelText('Posição vertical do braço')
        expect(slider).toHaveValue(String(DEFAULT_PLACEMENT.y))
        fireEvent.change(slider, { target: { value: '0.45' } })
        expect(screen.getByLabelText('Posição vertical do braço')).toHaveValue('0.45')
        fireEvent.click(screen.getByRole('button', { name: /restaurar o ajuste padrão/i }))
        expect(screen.getByLabelText('Posição vertical do braço')).toHaveValue(
            String(DEFAULT_PLACEMENT.y),
        )
    })

    it('ignorar dedos extras é uma caixa de seleção na gaveta', async () => {
        const h = await openWithCamera()
        h.setHands([fretHand([...EM, { string: 3, fret: 2 }]), strumHand(0.45)])
        h.run(14)
        expect(status()).toHaveTextContent(/tire o dedo 3 da corda 3/i)
        fireEvent.click(screen.getByRole('button', { name: 'Depuração' }))
        fireEvent.click(screen.getByLabelText(/ignorar dedos extras/i))
        h.run(2)
        expect(status()).not.toHaveTextContent(/tire o dedo/i)
    })

    it('mostra o motivo quando o detector de mão não inicia', async () => {
        const h = harness()
        const deps: GuitarDeps = {
            ...h.deps,
            createTracker: () => Promise.reject(new Error('GPU e CPU falharam')),
        }
        render(<GuitarScreen cameraGetUserMedia={() => Promise.resolve(createFakeStream().stream)} deps={deps} />)
        fireEvent.click(screen.getByRole('button', { name: /ativar câmera/i }))
        expect(await screen.findByText(/motivo: gpu e cpu falharam/i)).toBeInTheDocument()
        expect(status()).toHaveTextContent(/não foi possível iniciar o detector/i)
    })
})
