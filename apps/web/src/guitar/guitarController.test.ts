import { DEFAULT_PLACEMENT, type PlannedNote } from '@guess-my-move/guitar'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { EM, fretHand, smooth, strumHand } from '../test-utils/fakeGuitarHands.js'
import { type TrackedHand, type HandTracker } from '../tracker/handTracker.js'
import { type AudioPlayer, type AudioStatus } from './audioPlayer.js'
import { GuitarController, type GuitarEnv } from './guitarController.js'

function fakeAudio(initial: AudioStatus = 'running', unlockSucceeds = true) {
    const plays: PlannedNote[][] = []
    let status = initial
    const listeners = new Set<() => void>()
    const unlock = vi.fn(() => {
        if (unlockSucceeds) status = 'running'
        for (const listener of listeners) listener()
        return Promise.resolve()
    })
    const dispose = vi.fn()
    const player: AudioPlayer = {
        get status() {
            return status
        },
        unlock,
        play: (plan: readonly PlannedNote[]) => {
            if (status !== 'running') return false
            plays.push([...plan])
            return true
        },
        latency: () => ({ base: 0.01, output: 0.03 }),
        subscribe: (listener) => {
            listeners.add(listener)
            return () => {
                listeners.delete(listener)
            }
        },
        dispose,
    }
    return { player, plays, unlock, dispose }
}

function harness(
    options: { audioStatus?: AudioStatus; trackerError?: Error; unlockSucceeds?: boolean } = {},
) {
    let nowMs = 1000
    let videoTime = 0
    let queued: (() => void) | null = null
    const keys = new EventTarget()
    const video = document.createElement('video')
    Object.defineProperty(video, 'readyState', { value: 4 })
    Object.defineProperty(video, 'videoWidth', { value: 640 })
    Object.defineProperty(video, 'videoHeight', { value: 480 })
    Object.defineProperty(video, 'currentTime', { get: () => videoTime })
    const overlay = document.createElement('canvas')
    const state: { hands: TrackedHand[] } = { hands: [] }
    const closeTracker = vi.fn()
    const tracker: HandTracker = {
        delegate: 'CPU',
        detect: () => state.hands[0] ?? null,
        detectAll: () => state.hands,
        close: closeTracker,
    }
    const audio = fakeAudio(options.audioStatus, options.unlockSucceeds)
    const env: GuitarEnv = {
        createTracker: () =>
            options.trackerError ? Promise.reject(options.trackerError) : Promise.resolve(tracker),
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
    const controller = new GuitarController(env)
    controller.attach({ getVideo: () => video, getOverlay: () => overlay })
    return {
        controller,
        audio,
        closeTracker,
        keys,
        setHands(hands: TrackedHand[]) {
            state.hands = hands
        },
        /** Roda `count` quadros de 33 ms; cada um traz um quadro novo de câmera. */
        step(count = 1, stepMs = 33) {
            for (let i = 0; i < count; i++) {
                const callback = queued
                if (!callback) return
                queued = null
                nowMs += stepMs
                videoTime += stepMs / 1000
                callback()
            }
        },
        press: (key: string) => keys.dispatchEvent(new KeyboardEvent('keydown', { key })),
        async enableCamera() {
            controller.setCamera(true)
            await Promise.resolve()
            await Promise.resolve()
        },
        snapshot: () => controller.getSnapshot(),
    }
}

beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})

afterEach(() => {
    vi.restoreAllMocks()
})

/** Faz um golpe para baixo (6 quadros) com a mão da batida, mantendo a mão do braço formada. */
function strokeDown(h: ReturnType<typeof harness>, fret: TrackedHand) {
    for (let i = 0; i < 4; i++) {
        h.setHands([fret, strumHand(0.35)])
        h.step()
    }
    for (let i = 1; i <= 6; i++) {
        h.setHands([fret, strumHand(0.35 + 0.25 * smooth(i / 6))])
        h.step()
    }
    for (let i = 0; i < 4; i++) {
        h.setHands([fret, strumHand(0.6)])
        h.step()
    }
}

describe('GuitarController', () => {
    it('começa no Em, sem mãos, com o áudio ocioso e o acorde incompleto', () => {
        const h = harness({ audioStatus: 'idle' })
        const snap = h.snapshot()
        expect(snap.chord).toBe('Em')
        expect(snap.handsVisible).toBe(0)
        expect(snap.evaluation.complete).toBe(false)
        expect(snap.stable).toBe(false)
        expect(snap.audioStatus).toBe('idle')
        expect(snap.leftHanded).toBe(false)
    })

    it('com a mão formando o Em, o acorde fica completo e depois estável', async () => {
        const h = harness()
        await h.enableCamera()
        h.setHands([fretHand(EM), strumHand(0.45)])
        h.step(5)
        expect(h.snapshot().evaluation.complete).toBe(true)
        expect(h.snapshot().stable).toBe(false)
        h.step(9)
        expect(h.snapshot().stable).toBe(true)
        expect(h.snapshot().presses).toEqual([
            { finger: 1, string: 5, fret: 2 },
            { finger: 2, string: 4, fret: 2 },
        ])
        expect(h.snapshot().trackerStatus).toBe('ready')
    })

    it('uma batida da mão com o Em formado toca as seis cordas e marca o acorde como concluído', async () => {
        const h = harness()
        await h.enableCamera()
        const fret = fretHand(EM)
        h.setHands([fret, strumHand(0.35)])
        h.step(14)
        expect(h.snapshot().stable).toBe(true)
        strokeDown(h, fret)
        expect(h.audio.plays).toHaveLength(1)
        expect(h.audio.plays[0].map((note) => note.string)).toEqual([6, 5, 4, 3, 2, 1])
        expect(h.snapshot().lastStrum?.direction).toBe('down')
        expect(h.snapshot().lastStrum?.source).toBe('hand')
        expect(h.snapshot().completed).toEqual(['Em'])
    })

    it('a mão da batida parada não toca nada, mesmo com o acorde certo', async () => {
        const h = harness()
        await h.enableCamera()
        h.setHands([fretHand(EM), strumHand(0.45)])
        h.step(40)
        expect(h.snapshot().stable).toBe(true)
        expect(h.audio.plays).toHaveLength(0)
        expect(h.snapshot().lastStrum).toBeNull()
        expect(h.snapshot().completed).toEqual([])
    })

    it('ativar a câmera tenta liberar o áudio, porque a batida pela mão não é um gesto do usuário', async () => {
        const h = harness({ audioStatus: 'idle' })
        expect(h.audio.unlock).not.toHaveBeenCalled()
        await h.enableCamera()
        expect(h.audio.unlock).toHaveBeenCalled()
        expect(h.snapshot().audioStatus).toBe('running')
    })

    it('a batida com a mão não libera o áudio: se continua bloqueado, fica registrada como não ouvida', async () => {
        const h = harness({ audioStatus: 'idle', unlockSucceeds: false })
        await h.enableCamera()
        const unlocksAfterCamera = h.audio.unlock.mock.calls.length
        const fret = fretHand(EM)
        h.setHands([fret, strumHand(0.35)])
        h.step(14)
        strokeDown(h, fret)
        expect(h.audio.unlock.mock.calls.length).toBe(unlocksAfterCamera)
        expect(h.snapshot().lastStrum?.heard).toBe(false)
        expect(h.snapshot().audioStatus).toBe('idle')
        // sem som ouvido, o acorde não conta como concluído
        expect(h.snapshot().completed).toEqual([])
    })

    it('com o formato errado a batida toca o que a mão forma e não conclui o acorde', async () => {
        const h = harness()
        await h.enableCamera()
        // só o dedo 1 na corda 5: falta a corda 4
        const fret = fretHand([{ string: 5, fret: 2 }])
        h.setHands([fret, strumHand(0.35)])
        h.step(12)
        strokeDown(h, fret)
        const notes = h.audio.plays[0]
        expect(notes.find((note) => note.string === 5)?.midi).toBe(47)
        expect(notes.find((note) => note.string === 4)?.midi).toBe(50)
        expect(h.snapshot().completed).toEqual([])
        expect(h.snapshot().evaluation.correction).toEqual({
            action: 'place',
            finger: 3,
            string: 4,
            fret: 2,
        })
    })

    it('o teclado toca sem câmera: Espaço para baixo e seta para cima, ambos com o acorde alvo', () => {
        const h = harness()
        h.step(1)
        h.press(' ')
        h.press('ArrowUp')
        expect(h.audio.plays).toHaveLength(2)
        expect(h.audio.plays[0].map((note) => note.string)).toEqual([6, 5, 4, 3, 2, 1])
        expect(h.audio.plays[1].map((note) => note.string)).toEqual([1, 2, 3, 4, 5, 6])
        // sem mão, soa o Em escrito: corda 5 na casa 2 (B2 = 47)
        expect(h.audio.plays[0].find((note) => note.string === 5)?.midi).toBe(selectedMidi5())
        expect(h.snapshot().lastStrum?.source).toBe('key')
        expect(h.snapshot().completed).toEqual([])
    })

    it('qualquer tecla de controle tenta liberar o áudio', () => {
        const h = harness({ audioStatus: 'idle' })
        h.press(' ')
        expect(h.audio.unlock).toHaveBeenCalled()
    })

    it('uma tecla que não é de controle é ignorada', () => {
        const h = harness()
        h.press('a')
        expect(h.audio.plays).toHaveLength(0)
        expect(h.audio.unlock).not.toHaveBeenCalled()
    })

    it('strum() do clique toca para baixo', () => {
        const h = harness()
        h.controller.strum('down')
        expect(h.audio.plays).toHaveLength(1)
    })

    it('mudar o acorde alvo reavalia e zera a estabilidade', async () => {
        const h = harness()
        await h.enableCamera()
        h.setHands([fretHand(EM), strumHand(0.45)])
        h.step(14)
        expect(h.snapshot().stable).toBe(true)
        h.controller.setChord('Am')
        expect(h.snapshot().chord).toBe('Am')
        expect(h.snapshot().stable).toBe(false)
        expect(h.snapshot().evaluation.chord).toBe('Am')
        expect(h.snapshot().evaluation.complete).toBe(false)
    })

    it('canhoto: o braço se espelha e a mão do lado direito forma o acorde', async () => {
        const h = harness()
        await h.enableCamera()
        h.controller.setLeftHanded(true)
        const placement = h.snapshot().placement
        expect(placement.leftHanded).toBe(true)
        h.setHands([strumHand(0.45, 0.15), fretHand(EM, placement)])
        h.step(14)
        expect(h.snapshot().evaluation.complete).toBe(true)
        expect(h.snapshot().stable).toBe(true)
    })

    it('ajustar a posição do braço muda o mapeamento dos dedos', async () => {
        const h = harness()
        await h.enableCamera()
        const moved = { ...DEFAULT_PLACEMENT, y: DEFAULT_PLACEMENT.y + 0.15 }
        h.controller.setPlacement(moved)
        h.setHands([fretHand(EM, moved), strumHand(0.45)])
        h.step(14)
        expect(h.snapshot().evaluation.complete).toBe(true)
        expect(h.snapshot().placement.y).toBe(moved.y)
    })

    it('a mão que some por tempo demais zera os dedos', async () => {
        const h = harness()
        await h.enableCamera()
        h.setHands([fretHand(EM), strumHand(0.45)])
        h.step(14)
        expect(h.snapshot().presses).toHaveLength(2)
        h.setHands([])
        h.step(25)
        expect(h.snapshot().presses).toEqual([])
        expect(h.snapshot().handsVisible).toBe(0)
        expect(h.snapshot().stable).toBe(false)
    })

    it('desligar a câmera solta o rastreador e limpa as mãos', async () => {
        const h = harness()
        await h.enableCamera()
        h.setHands([fretHand(EM), strumHand(0.45)])
        h.step(6)
        h.controller.setCamera(false)
        expect(h.closeTracker).toHaveBeenCalled()
        expect(h.snapshot().handsVisible).toBe(0)
        expect(h.snapshot().trackerStatus).toBe('idle')
    })

    it('um rastreador que falha vira erro com o motivo', async () => {
        const h = harness({ trackerError: new Error('GPU e CPU falharam') })
        await h.enableCamera()
        await Promise.resolve()
        expect(h.snapshot().trackerStatus).toBe('error')
        expect(h.snapshot().trackerFailure).toMatch(/GPU e CPU falharam/)
    })

    it('expõe os números de depuração: dedos, velocidade da batida, fps e latência', async () => {
        const h = harness()
        await h.enableCamera()
        h.setHands([fretHand(EM), strumHand(0.45)])
        h.step(14)
        const { debug } = h.snapshot()
        expect(debug.fingers).toHaveLength(4)
        expect(debug.fingers[0]?.cell).toEqual({ string: 5, fret: 2 })
        expect(debug.fps).toBeGreaterThan(20)
        expect(debug.fps).toBeLessThan(40)
        expect(debug.latency).toEqual({ base: 0.01, output: 0.03 })
        expect(debug.delegate).toBe('CPU')
        expect(typeof debug.strumSpeed).toBe('number')
    })

    it('ignorar dedos extras é uma opção de calibração', async () => {
        const h = harness()
        await h.enableCamera()
        h.controller.setIgnoreExtraFingers(true)
        const extra = fretHand([...EM, { string: 3, fret: 2 }])
        h.setHands([extra, strumHand(0.45)])
        h.step(14)
        expect(h.snapshot().evaluation.complete).toBe(true)
    })

    it('detach solta o rastreador e o teclado', async () => {
        const h = harness()
        await h.enableCamera()
        h.controller.detach()
        h.press(' ')
        expect(h.audio.plays).toHaveLength(0)
        expect(h.closeTracker).toHaveBeenCalled()
        expect(h.audio.dispose).toHaveBeenCalled()
    })
})

/** Nota MIDI da corda 5 na casa 2 (45 + 2). */
function selectedMidi5(): number {
    return 45 + 2
}
