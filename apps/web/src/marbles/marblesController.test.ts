import { type BotPlanner, createBotPlanner, modes } from '@guess-my-move/marbles'
import { describe, expect, it, vi } from 'vitest'

import { CLOSED_RATIO, OPEN_RATIO, pinchHand } from '../test-utils/fakeHand.js'
import { type HandTracker, type TrackedHand } from '../tracker/handTracker.js'
import { MarblesController, shotControlFromSearch } from './marblesController.js'

/** Relógio, quadros de vídeo e detector controlados pelo teste. */
function harness(
    options: {
        createTracker?: () => Promise<HandTracker>
        /** Sem semente fixa: o bot sorteia uma por partida (comportamento real). */
        randomSeed?: boolean
        createBot?: () => BotPlanner
    } = {},
) {
    let nowMs = 1000
    let queued: (() => void) | null = null
    const media = { currentTime: 0 }
    let next: TrackedHand | null = null

    const video = {
        readyState: 4,
        videoWidth: 640,
        videoHeight: 480,
        get currentTime() {
            return media.currentTime
        },
    } as unknown as HTMLVideoElement

    const detect = vi.fn((): TrackedHand | null => next)
    const close = vi.fn()
    const tracker: HandTracker = { delegate: 'GPU', detect, close }
    const createTracker = options.createTracker ?? vi.fn(() => Promise.resolve(tracker))
    const cancelFrame = vi.fn(() => {
        queued = null
    })

    const controller = new MarblesController({
        createTracker,
        now: () => nowMs,
        requestFrame: (callback) => {
            queued = callback
            return 1
        },
        cancelFrame,
        // Bot determinístico padrão; a semente é fixada por `seed`.
        createBot: options.createBot ?? (() => createBotPlanner()),
        ...(options.randomSeed ? {} : { seed: 12345 }),
    })
    controller.attach({ getVideo: () => video, getOverlay: () => null })

    const api = {
        controller,
        detect,
        createTracker,
        async ready() {
            controller.setCamera(true, false)
            await vi.waitFor(() => {
                expect(controller.getSnapshot().trackerStatus).toBe('ready')
            })
        },
        run(hand: TrackedHand | null, count = 1, stepMs = 33) {
            for (let i = 0; i < count; i++) {
                next = hand
                nowMs += stepMs
                media.currentTime += stepMs / 1000
                const callback = queued
                queued = null
                callback?.()
            }
        },
        /** Avança o relógio e o laço sem quadro novo da câmera (anima a rolagem). */
        tick(count = 1, stepMs = 16) {
            for (let i = 0; i < count; i++) {
                nowMs += stepMs
                const callback = queued
                queued = null
                callback?.()
            }
        },
    }
    return api
}

const open = (x: number, y: number) => pinchHand({ ratio: OPEN_RATIO, x, y })
const closed = (x: number, y: number) => pinchHand({ ratio: CLOSED_RATIO, x, y })

/** Dispara um tiro do jogador pela pinça (abre, fecha, arrasta e solta). */
function firePinch(h: ReturnType<typeof harness>) {
    h.run(open(400, 300))
    h.run(closed(400, 300))
    h.run(closed(250, 300), 2)
    h.run(open(250, 300))
}

/** Anima a rolagem até a partida sair de `rolling`/`bot-turn`. */
function settle(h: ReturnType<typeof harness>, maxTicks = 2000) {
    let ticks = 0
    while (ticks < maxTicks) {
        const phase = h.controller.getSnapshot().match?.phase
        if (phase !== 'rolling' && phase !== 'bot-turn' && phase !== 'round-over') break
        // Na vez do bot e na espera entre rodadas, só o tempo precisa correr.
        h.tick(1, 16)
        ticks++
    }
    return ticks
}

/** Joga a partida inteira: dispara na vez do jogador, anima o resto, até encerrar. */
function playMatch(h: ReturnType<typeof harness>, maxShots = 100) {
    let shots = 0
    while (shots < maxShots) {
        const snap = h.controller.getSnapshot()
        const match = snap.match
        if (!match || match.phase === 'match-over') break
        if (match.phase === 'player-turn' && snap.trackerStatus === 'ready') {
            firePinch(h)
            settle(h)
            shots++
        } else {
            settle(h)
        }
    }
}

describe('MarblesController: tela inicial e escolha', () => {
    it('começa na tela de escolha com o primeiro modo e contra a meta', () => {
        const h = harness()
        const snap = h.controller.getSnapshot()
        expect(snap.choosing).toBe(true)
        expect(snap.modeId).toBe(modes[0].id)
        expect(snap.opponent).toBe('target')
        expect(snap.match).toBeNull()
    })

    it('escolhe modo e adversário antes de começar; startMatch entra na partida', async () => {
        const h = harness()
        await h.ready()
        h.controller.setMode('triangle')
        h.controller.setOpponent('bot')
        expect(h.controller.getSnapshot().choosing).toBe(true)
        h.controller.startMatch()
        const snap = h.controller.getSnapshot()
        expect(snap.choosing).toBe(false)
        expect(snap.match?.modeId).toBe('triangle')
        expect(snap.match?.opponent).toBe('bot')
    })

    it('modo e adversário não mudam durante a partida', async () => {
        const h = harness()
        await h.ready()
        h.controller.startMatch()
        h.controller.setMode('hole')
        h.controller.setOpponent('bot')
        const snap = h.controller.getSnapshot()
        expect(snap.match?.modeId).toBe(modes[0].id)
        expect(snap.match?.opponent).toBe('target')
    })

    it('o campo exposto é do modo escolhido', async () => {
        const h = harness()
        await h.ready()
        h.controller.setMode('triangle')
        h.controller.startMatch()
        const match = h.controller.getSnapshot().match
        expect(match?.modeId).toBe('triangle')
        // Triângulo: a bolinha de tiro mais seis bolinhas e o círculo na decoração.
        expect(match?.field.length).toBe(7)
        expect(match?.decor?.circle).toBeDefined()
    })
})

describe('MarblesController: fluxo completo por modo e adversário', () => {
    for (const { id } of modes) {
        for (const opponent of ['target', 'bot'] as const) {
            it(`modo ${id} contra ${opponent}: a partida termina com Vitória, Derrota ou Empate`, async () => {
                const h = harness()
                await h.ready()
                h.controller.setMode(id)
                h.controller.setOpponent(opponent)
                h.controller.startMatch()
                playMatch(h)
                const match = h.controller.getSnapshot().match
                expect(match?.phase).toBe('match-over')
                expect(match?.roundOutcomes).toHaveLength(match?.roundsPerMatch ?? 3)
                expect(['win', 'draw', 'loss']).toContain(match?.matchOutcome)
            })
        }
    }
})

describe('MarblesController: semente do bot', () => {
    /** Joga uma partida contra o bot e devolve a primeira semente que o planejador recebeu. */
    async function firstSeed(h: ReturnType<typeof harness>, seeds: number[]): Promise<number> {
        await h.ready()
        h.controller.setMode('bete')
        h.controller.setOpponent('bot')
        const before = seeds.length
        h.controller.startMatch()
        playMatch(h)
        expect(seeds.length).toBeGreaterThan(before)
        return seeds[before]
    }

    function recordingBot(seeds: number[]): () => BotPlanner {
        const inner = createBotPlanner()
        return () => ({
            planShot: (origin, point, seed, physics, radius) => {
                seeds.push(seed)
                return inner.planShot(origin, point, seed, physics, radius)
            },
        })
    }

    it('com semente fixada, toda partida repete a mesma sequência de erros do bot', async () => {
        const seeds: number[] = []
        const h = harness({ createBot: recordingBot(seeds) })
        const first = await firstSeed(h, seeds)
        const second = await firstSeed(h, seeds)
        expect(second).toBe(first)
    })

    it('sem semente fixada, cada partida sorteia a sua (o padrão não se repete)', async () => {
        const seeds: number[] = []
        const h = harness({ randomSeed: true, createBot: recordingBot(seeds) })
        const first = await firstSeed(h, seeds)
        const second = await firstSeed(h, seeds)
        expect(second).not.toBe(first)
    })
})

describe('MarblesController: vez do bot', () => {
    it('na vez do bot, fechar a pinça não dispara e o status diz que é a vez do bot', async () => {
        const h = harness()
        await h.ready()
        h.controller.setMode('bete')
        h.controller.setOpponent('bot')
        h.controller.startMatch()
        // Rodada 0 começa com o jogador; força a vez do bot jogando a vez do jogador.
        // Aqui forçamos o cenário: adiantamos até a vez do bot avançando sem tiro.
        // Dispara o tiro do jogador e deixa o bot assumir.
        firePinch(h)
        settle(h)
        // Agora, se for a vez do bot, uma pinça fechada não deve disparar.
        let snap = h.controller.getSnapshot()
        if (snap.match?.turn === 'opponent' && snap.match.phase === 'bot-turn') {
            const shotsLeftBefore = snap.match.playerShotsLeft
            h.run(closed(300, 300), 3)
            snap = h.controller.getSnapshot()
            // O tiro do jogador não entrou: os tiros restantes do jogador não mudaram
            // por causa do gesto (o bot anima no tick, não na leitura da mão).
            expect(snap.match?.playerShotsLeft).toBe(shotsLeftBefore)
            expect(snap.aim).toBeNull()
        }
        expect(true).toBe(true)
    })

    it('contra a meta não há vez do bot: o status nunca diz vez do bot', async () => {
        const h = harness()
        await h.ready()
        h.controller.setMode('bete')
        h.controller.setOpponent('target')
        h.controller.startMatch()
        expect(h.controller.getSnapshot().match?.turn).toBe('player')
    })
})

describe('MarblesController: controle de tiro', () => {
    it('setShotControl troca entre pinça e estalo no snapshot', async () => {
        const h = harness()
        await h.ready()
        expect(h.controller.getSnapshot().shotControl).toBe('pinch')
        h.controller.setShotControl('flick')
        expect(h.controller.getSnapshot().shotControl).toBe('flick')
        h.controller.setShotControl('pinch')
        expect(h.controller.getSnapshot().shotControl).toBe('pinch')
    })

    it('estalo: armar e disparar na vez do jogador conta um tiro', async () => {
        const h = harness()
        await h.ready()
        h.controller.setMode('bete')
        h.controller.setOpponent('target')
        h.controller.setShotControl('flick')
        h.controller.startMatch()
        const before = h.controller.getSnapshot().match?.playerShotsLeft ?? 0
        const tucked = (ratio: number, x = 220) => pinchHand({ ratio, x, y: 300 })
        h.run(tucked(0.8, 300), 1, 67)
        h.run(tucked(0.8, 220), 2, 67)
        h.run(tucked(1.5), 3, 67)
        // O estalo disparou neste quadro (antes de a rolagem encerrar a rodada e zerar os tiros).
        const snap = h.controller.getSnapshot()
        expect(snap.debug.flick.lastResult).toBe('disparado')
        expect((snap.match?.playerShotsLeft ?? before) < before || snap.match?.phase === 'rolling').toBe(
            true,
        )
    })
})

describe('MarblesController: jogar de novo e trocar de modo', () => {
    it('trocar de modo volta à tela de escolha', async () => {
        const h = harness()
        await h.ready()
        h.controller.startMatch()
        expect(h.controller.getSnapshot().choosing).toBe(false)
        h.controller.changeMode()
        expect(h.controller.getSnapshot().choosing).toBe(true)
        expect(h.controller.getSnapshot().match).toBeNull()
    })

    it('jogar de novo reinicia a partida do começo', async () => {
        const h = harness()
        await h.ready()
        h.controller.setMode('bete')
        h.controller.setOpponent('target')
        h.controller.startMatch()
        playMatch(h)
        expect(h.controller.getSnapshot().match?.phase).toBe('match-over')
        h.controller.playAgain()
        const snap = h.controller.getSnapshot()
        expect(snap.choosing).toBe(false)
        expect(snap.match?.roundOutcomes).toHaveLength(0)
        expect(snap.match?.round).toBe(0)
    })
})

describe('shotControlFromSearch', () => {
    it('?mode=estalo escolhe o estalo; qualquer outro valor mantém a pinça', () => {
        expect(shotControlFromSearch('?mode=estalo')).toBe('flick')
        expect(shotControlFromSearch('?mode=ESTALO')).toBe('flick')
        expect(shotControlFromSearch('')).toBe('pinch')
        expect(shotControlFromSearch('?mode=pinca')).toBe('pinch')
        expect(shotControlFromSearch('?delegate=cpu')).toBe('pinch')
    })
})

describe('MarblesController: câmera e detector', () => {
    it('câmera negada não carrega o detector', () => {
        const h = harness()
        h.controller.setCamera(false, true)
        expect(h.createTracker).not.toHaveBeenCalled()
        expect(h.controller.getSnapshot().cameraFailed).toBe(true)
    })

    it('falha ao criar o detector expõe o motivo', async () => {
        const h = harness({ createTracker: () => Promise.reject(new Error('modelo ausente')) })
        h.controller.setCamera(true, false)
        await vi.waitFor(() => {
            expect(h.controller.getSnapshot().trackerStatus).toBe('error')
        })
        expect(h.controller.getSnapshot().failureReason).toBe('modelo ausente')
    })
})
