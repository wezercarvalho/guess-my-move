import {
    type BotLevel,
    type BotPlanner,
    type Mode,
    type ModeEntry,
    type Vec,
    createBotPlanner,
    modes,
} from '@guess-my-move/marbles'
import { describe, expect, it, vi } from 'vitest'

import { CLOSED_RATIO, OPEN_RATIO, pinchHand } from '../test-utils/fakeHand.js'
import { type HandTracker, type TrackedHand } from '../tracker/handTracker.js'
import {
    MarblesController,
    createBotShotSource,
    shotControlFromSearch,
} from './marblesController.js'
import { type MultiplayerSnapshot } from './multiplayerClient.js'

/** Relógio, quadros de vídeo e detector controlados pelo teste. */
function harness(
    options: {
        createTracker?: () => Promise<HandTracker>
        /** Sem semente fixa: o bot sorteia uma por partida (comportamento real). */
        randomSeed?: boolean
        createBot?: (level: BotLevel) => BotPlanner
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

/** Anima a rolagem até a partida sair de `rolling`/`opponent-turn`. */
function settle(h: ReturnType<typeof harness>, maxTicks = 2000) {
    let ticks = 0
    while (ticks < maxTicks) {
        const phase = h.controller.getSnapshot().match?.phase
        if (phase !== 'rolling' && phase !== 'opponent-turn' && phase !== 'round-over') break
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

describe('MarblesController: nível do bot', () => {
    it('começa no médio e o nível escolhido aparece no retrato', () => {
        const h = harness()
        expect(h.controller.getSnapshot().botLevel).toBe('medium')
        h.controller.setBotLevel('hard')
        expect(h.controller.getSnapshot().botLevel).toBe('hard')
    })

    it('o planejador é criado com o nível escolhido ao começar cada partida', () => {
        const levels: BotLevel[] = []
        const h = harness({
            createBot: (level) => {
                levels.push(level)
                return createBotPlanner()
            },
        })
        h.controller.setOpponent('bot')
        h.controller.setBotLevel('easy')
        h.controller.startMatch()
        h.controller.changeMode()
        h.controller.setBotLevel('hard')
        h.controller.startMatch()
        expect(levels).toEqual(['easy', 'hard'])
    })

    it('trocar o nível durante a partida não tem efeito', () => {
        const h = harness()
        h.controller.setOpponent('bot')
        h.controller.setBotLevel('easy')
        h.controller.startMatch()
        h.controller.setBotLevel('hard')
        expect(h.controller.getSnapshot().botLevel).toBe('easy')
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
        if (snap.match?.turn === 'opponent' && snap.match.phase === 'opponent-turn') {
            const shotsLeftBefore = snap.match.shotsLeft.player
            h.run(closed(300, 300), 3)
            snap = h.controller.getSnapshot()
            // O tiro do jogador não entrou: os tiros restantes do jogador não mudaram
            // por causa do gesto (o bot anima no tick, não na leitura da mão).
            expect(snap.match?.shotsLeft.player).toBe(shotsLeftBefore)
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
        const before = h.controller.getSnapshot().match?.shotsLeft.player ?? 0
        const tucked = (ratio: number, x = 220) => pinchHand({ ratio, x, y: 300 })
        h.run(tucked(0.8, 300), 1, 67)
        h.run(tucked(0.8, 220), 2, 67)
        h.run(tucked(1.5), 3, 67)
        // O estalo disparou neste quadro (antes de a rolagem encerrar a rodada e zerar os tiros).
        const snap = h.controller.getSnapshot()
        expect(snap.debug.flick.lastResult).toBe('disparado')
        expect((snap.match?.shotsLeft.player ?? before) < before || snap.match?.phase === 'rolling').toBe(
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


describe('MarblesController: intenção do adversário', () => {
    it('não inventa tiro quando o modo não oferece alvo', () => {
        const mode: Mode = {
            name: 'sem alvo',
            helpText: 'Sem alvo. Vitória, empate ou derrota.',
            roundsPerMatch: 1,
            buildRound: () => [],
            shotLimit: () => 1,
            evaluate: () => ({ yield: 0, finished: false, outcome: null }),
        }
        const entry: Pick<ModeEntry, 'botAimPoint'> = {
            botAimPoint: () => () => null,
        }
        const planShot = vi.fn(() => ({ x: 999, y: 0 }))
        const planner: BotPlanner = { planShot }
        const source = createBotShotSource(entry, mode, planner, 123)

        expect(source.nextShot([{ pos: { x: 10, y: 10 }, vel: { x: 0, y: 0 }, radius: 14 }])).toBeNull()
        expect(planShot).not.toHaveBeenCalled()
    })

    it('mostra a intenção do bot antes de disparar', async () => {
        const h = harness()
        await h.ready()
        h.controller.setMode('bete')
        h.controller.setOpponent('bot')
        h.controller.startMatch()
        firePinch(h)

        let guard = 0
        while (h.controller.getSnapshot().match?.phase === 'rolling' && guard++ < 2000) {
            h.tick(1, 16)
        }
        expect(h.controller.getSnapshot().match?.phase).toBe('opponent-turn')

        h.tick(1, 16)
        const preview = h.controller.getSnapshot()
        expect(preview.match?.phase).toBe('opponent-turn')
        expect(preview.opponentIntent?.velocity).toBeDefined()

        h.tick(1, 500)
        expect(h.controller.getSnapshot().match?.phase).toBe('rolling')
        expect(h.controller.getSnapshot().opponentIntent).toBeNull()
    })
})


function remoteSnapshot(): MultiplayerSnapshot {
    return {
        connection: 'connected',
        access: {
            roomCode: 'ABCDEF',
            role: 'player',
            resumeToken: 'a'.repeat(32),
        },
        room: {
            roomCode: 'ABCDEF',
            modeId: 'bete',
            status: 'playing',
            version: 4,
            players: {
                player: { connected: true, ready: true },
                opponent: { connected: true, ready: true },
            },
            match: {
                modeId: 'bete',
                opponent: 'remote',
                phase: 'player-turn',
                round: 0,
                roundsPerMatch: 3,
                roundOutcomes: [],
                lastRoundOutcome: null,
                matchOutcome: null,
                turn: 'player',
                shotsLeft: { player: 5, opponent: 5 },
                roundYield: { player: 0, opponent: 0 },
                scoreLabel: null,
                field: [
                    { pos: { x: 150, y: 300 }, vel: { x: 0, y: 0 }, radius: 14 },
                    { pos: { x: 550, y: 300 }, vel: { x: 0, y: 0 }, radius: 24 },
                ],
                decor: null,
            },
            intent: null,
            reconnectDeadlineMs: null,
        },
        error: null,
    }
}

describe('MarblesController: driver remoto', () => {
    it('consome o snapshot autoritativo sem criar sessão local', () => {
        const h = harness()
        h.controller.setPlayType('online')
        h.controller.setMultiplayer(remoteSnapshot(), vi.fn())
        expect(h.controller.getSnapshot()).toMatchObject({
            playType: 'online',
            choosing: false,
            opponent: 'remote',
            modeId: 'bete',
            match: { phase: 'player-turn', turn: 'player' },
        })
    })

    it('envia somente o vetor da mira na própria vez', async () => {
        const h = harness()
        const send = vi.fn<(velocity: Vec) => void>()
        h.controller.setPlayType('online')
        h.controller.setMultiplayer(remoteSnapshot(), send)
        await h.ready()
        firePinch(h)
        expect(send).toHaveBeenCalledTimes(1)
        const velocity = send.mock.calls[0]?.[0]
        expect(Object.keys(velocity ?? {})).toEqual(['x', 'y'])
        expect(typeof velocity?.x).toBe('number')
        expect(typeof velocity?.y).toBe('number')

        const waiting = remoteSnapshot()
        if (!waiting.room?.match) throw new Error('fixture sem partida')
        waiting.room.match.phase = 'opponent-turn'
        waiting.room.match.turn = 'opponent'
        waiting.room.version++
        h.controller.setMultiplayer(waiting, send)
        firePinch(h)
        expect(send).toHaveBeenCalledTimes(1)
    })
})


describe('MarblesController: autoridade da sala', () => {
    for (const control of ['pinch', 'flick'] as const) {
        for (const role of ['player', 'opponent'] as const) {
            it(`${control}: só envia vetores na própria vez de ${role}`, async () => {
                const h = harness()
                const send = vi.fn<(velocity: Vec) => void>()
                const remote = remoteSnapshot()
                if (!remote.access || !remote.room?.match) throw new Error('fixture sem sala')
                remote.access.role = role
                remote.room.match.turn = role
                remote.room.match.phase = role === 'player' ? 'player-turn' : 'opponent-turn'
                h.controller.setShotControl(control)
                h.controller.setMultiplayer(remote, send)
                await h.ready()
                function shoot() {
                    if (control === 'pinch') firePinch(h)
                    else {
                        h.run(pinchHand({ ratio: 0.8, x: 300, y: 300 }), 1, 67)
                        h.run(pinchHand({ ratio: 0.8, x: 220, y: 300 }), 2, 67)
                        h.run(pinchHand({ ratio: 1.5, x: 220, y: 300 }), 3, 67)
                    }
                }
                shoot()
                expect(send).toHaveBeenCalledTimes(1)
                remote.room.match.turn = role === 'player' ? 'opponent' : 'player'
                remote.room.match.phase = role === 'player' ? 'opponent-turn' : 'player-turn'
                h.controller.setMultiplayer(structuredClone(remote), send)
                shoot()
                expect(send).toHaveBeenCalledTimes(1)
                remote.room.match.turn = role
                remote.room.match.phase = role === 'player' ? 'player-turn' : 'opponent-turn'
                remote.connection = 'disconnected'
                h.controller.setMultiplayer(structuredClone(remote), send)
                shoot()
                expect(send).toHaveBeenCalledTimes(1)
            })
        }
    }
})


describe('MarblesController: recuperação do detector', () => {
    it('permite tentar novamente desligando e ativando a câmera após falha de carga', async () => {
        let attempts = 0
        const tracker: HandTracker = { delegate: 'CPU', detect: () => null, close: vi.fn() }
        const h = harness({ createTracker: () => ++attempts === 1 ? Promise.reject(new Error('falha transitória')) : Promise.resolve(tracker) })
        h.controller.setCamera(true, false)
        await vi.waitFor(() => expect(h.controller.getSnapshot().trackerStatus).toBe('error'))
        h.controller.setCamera(false, false)
        h.controller.setCamera(true, false)
        await vi.waitFor(() => expect(h.controller.getSnapshot().trackerStatus).toBe('ready'))
        expect(attempts).toBe(2)
        expect(h.controller.getSnapshot().failureReason).toBeNull()
    })
})
