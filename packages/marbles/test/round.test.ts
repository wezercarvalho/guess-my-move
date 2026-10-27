import { describe, expect, it } from 'vitest'

import { type FlickReading, type FlickRelease } from '../src/flick.js'
import { type PinchReading } from '../src/pinch.js'
import { createBeteRound } from '../src/round.js'

const W = 800
const H = 600

/** Leitura da pinça com o ponto dado em coordenadas do campo. */
const reading = (x: number, y: number, closed: boolean): PinchReading => ({
    handVisible: true,
    closed,
    ratio: closed ? 0.2 : 0.8,
    point: { x: x / W, y: y / H },
})
const noHand: PinchReading = { handVisible: false, closed: false, ratio: null, point: null }

/** Rodada pronta, com a pinça aberta já observada (como numa câmera real). Escala 1 mantém as contas em unidades do campo. */
function readyRound() {
    const round = createBeteRound({ aimScale: 1 })
    round.cameraReady()
    round.observePinch(reading(100, 300, false), 0)
    return round
}

/** Pega a bolinha de tiro e arrasta até o ponto dado, sem soltar. */
function aimAt(round: ReturnType<typeof createBeteRound>, x: number, y: number, t = 100) {
    round.observePinch(reading(150, 300, true), t)
    round.observePinch(reading(x, y, true), t + 16)
}

/** Avança a rodada em quadros de 16 ms até a condição, com limite de segurança. */
function runUntil(
    round: ReturnType<typeof createBeteRound>,
    done: () => boolean,
    maxFrames = 600,
) {
    let frames = 0
    while (!done() && frames < maxFrames) {
        round.advance(16)
        frames++
    }
    return frames
}

describe('createBeteRound: início e câmera', () => {
    it('começa ociosa, com as bolinhas nas posições iniciais e sem tiros', () => {
        const snap = createBeteRound().snapshot()
        expect(snap.state).toBe('idle')
        expect(snap.shooter).toEqual({ x: 150, y: 300 })
        expect(snap.target).toEqual({ x: 550, y: 300 })
        expect(snap.shots).toBe(0)
        expect(snap.aim).toBeNull()
        expect(snap.hitShots).toBeNull()
    })

    it('cameraReady leva a ready; denyCamera leva a camera_denied e cameraReady recupera', () => {
        const round = createBeteRound()
        round.denyCamera()
        expect(round.state).toBe('camera_denied')
        round.cameraReady()
        expect(round.state).toBe('ready')
    })

    it('ignora a pinça enquanto a câmera não está pronta', () => {
        const round = createBeteRound()
        round.observePinch(reading(100, 300, false), 0)
        round.observePinch(reading(150, 300, true), 16)
        expect(round.state).toBe('idle')
    })

    it('trackerFailed leva a tracker_error com o motivo e newRound recupera', () => {
        const round = readyRound()
        round.trackerFailed('modelo ausente')
        expect(round.state).toBe('tracker_error')
        expect(round.snapshot().failureReason).toBe('modelo ausente')
        round.newRound()
        expect(round.state).toBe('ready')
        expect(round.snapshot().failureReason).toBeNull()
    })
})

describe('createBeteRound: mira', () => {
    it('a pinça fechada em qualquer ponto do campo inicia a mira, sem exigir proximidade da bolinha', () => {
        const round = readyRound()
        round.observePinch(reading(700, 500, true), 16)
        expect(round.state).toBe('aiming')
    })

    it('a mira é relativa: só o arrasto importa, não o ponto onde a pinça fechou', () => {
        const near = readyRound()
        aimAt(near, 50, 300)
        const far = readyRound()
        far.observePinch(reading(700, 500, true), 100)
        far.observePinch(reading(600, 500, true), 116)
        expect(far.snapshot().aim?.shot?.velocity.x).toBeCloseTo(
            near.snapshot().aim?.shot?.velocity.x ?? Number.NaN,
            6,
        )
        expect(far.snapshot().aim?.shot?.velocity.y).toBeCloseTo(0, 9)
    })

    it('arrastar para a direita e para baixo lança a bolinha para a esquerda e para cima', () => {
        const round = readyRound()
        round.observePinch(reading(300, 200, true), 100)
        round.observePinch(reading(380, 260, true), 116)
        const velocity = round.snapshot().aim?.shot?.velocity
        expect(velocity?.x).toBeLessThan(0)
        expect(velocity?.y).toBeLessThan(0)
    })

    it('o elástico aparece partindo da bolinha: a pinça virtual é a bolinha mais o arrasto', () => {
        const round = readyRound()
        round.observePinch(reading(700, 500, true), 100)
        round.observePinch(reading(660, 470, true), 116)
        const pinch = round.snapshot().aim?.pinch
        expect(pinch?.x).toBeCloseTo(150 - 40, 6)
        expect(pinch?.y).toBeCloseTo(300 - 30, 6)
    })

    it('por padrão o arrasto da mão vale 1,5 vez no campo (menos movimento do braço)', () => {
        const round = createBeteRound()
        round.cameraReady()
        round.observePinch(reading(400, 300, false), 0)
        round.observePinch(reading(400, 300, true), 100)
        round.observePinch(reading(300, 300, true), 116)
        expect(round.snapshot().aim?.shot?.pull).toBeCloseTo(150, 6)
        expect(round.snapshot().aim?.shot?.velocity.x).toBeCloseTo(750, 6)
    })

    it('só inicia ao fechar: uma pinça já fechada ao aparecer não inicia a mira', () => {
        const round = createBeteRound()
        round.cameraReady()
        round.observePinch(reading(400, 100, true), 0)
        round.observePinch(reading(400, 100, true), 16)
        expect(round.state).toBe('ready')
    })

    it('depois de cancelar com um arrasto curto, abrir e fechar a pinça inicia uma nova mira', () => {
        const round = readyRound()
        aimAt(round, 140, 300)
        round.observePinch(reading(140, 300, false), 200)
        expect(round.state).toBe('ready')
        round.observePinch(reading(300, 300, true), 216)
        expect(round.state).toBe('aiming')
    })

    it('mostra a pinça e a previsão do tiro durante a mira', () => {
        const round = readyRound()
        aimAt(round, 50, 300)
        const { aim, state } = round.snapshot()
        expect(state).toBe('aiming')
        expect(aim?.pinch.x).toBeCloseTo(50, 6)
        expect(aim?.shot?.velocity.x).toBeCloseTo(500, 6)
    })

    it('arrasto curto não gera previsão de tiro', () => {
        const round = readyRound()
        aimAt(round, 140, 300)
        expect(round.snapshot().aim?.shot).toBeNull()
    })

    it('soltar com arrasto curto cancela sem contar tiro', () => {
        const round = readyRound()
        aimAt(round, 140, 300)
        round.observePinch(reading(140, 300, false), 200)
        expect(round.state).toBe('ready')
        expect(round.snapshot().shots).toBe(0)
        expect(round.snapshot().aim).toBeNull()
    })

    it('perder a mão por mais de 300 ms cancela a mira', () => {
        const round = readyRound()
        aimAt(round, 50, 300, 100)
        round.observePinch(noHand, 300)
        expect(round.state).toBe('aiming')
        round.observePinch(noHand, 450)
        expect(round.state).toBe('ready')
        expect(round.snapshot().shots).toBe(0)
    })

    it('perder a mão por menos de 300 ms mantém a mira', () => {
        const round = readyRound()
        aimAt(round, 50, 300, 100)
        round.observePinch(noHand, 200)
        round.observePinch(reading(50, 300, true), 300)
        expect(round.state).toBe('aiming')
    })
})

describe('createBeteRound: tiro, erro e acerto', () => {
    it('soltar com arrasto suficiente dispara: conta o tiro e a bolinha de tiro se move', () => {
        const round = readyRound()
        aimAt(round, 50, 300)
        round.observePinch(reading(50, 300, false), 200)
        expect(round.state).toBe('rolling')
        expect(round.snapshot().shots).toBe(1)
        round.advance(100)
        expect(round.snapshot().shooter.x).toBeGreaterThan(150)
    })

    it('ignora a pinça enquanto as bolinhas rolam', () => {
        const round = readyRound()
        aimAt(round, 50, 300)
        round.observePinch(reading(50, 300, false), 200)
        round.observePinch(reading(150, 300, true), 220)
        expect(round.state).toBe('rolling')
    })

    it('erro: quando tudo para, a bolinha de tiro volta ao início e o jogador atira de novo', () => {
        const round = readyRound()
        aimAt(round, 150, 220) // lança para baixo, longe do alvo
        round.observePinch(reading(150, 220, false), 200)
        runUntil(round, () => round.state !== 'rolling')
        expect(round.state).toBe('ready')
        const snap = round.snapshot()
        expect(snap.shooter).toEqual({ x: 150, y: 300 })
        expect(snap.target).toEqual({ x: 550, y: 300 })
        expect(snap.shots).toBe(1)
        expect(snap.hitShots).toBeNull()
    })

    it('acerto: o primeiro contato termina a rodada com o número de tiros', () => {
        const round = readyRound()
        aimAt(round, 0, 300) // arrasto de 150 unidades rumo ao alvo
        round.observePinch(reading(0, 300, false), 200)
        runUntil(round, () => round.state !== 'rolling')
        expect(round.state).toBe('hit')
        expect(round.snapshot().hitShots).toBe(1)
    })

    it('depois do acerto continua animando até parar, sem sair de hit', () => {
        const round = readyRound()
        aimAt(round, 0, 300)
        round.observePinch(reading(0, 300, false), 200)
        runUntil(round, () => round.state === 'hit')
        const before = round.snapshot().target.x
        runUntil(round, () => false, 120)
        expect(round.state).toBe('hit')
        expect(round.snapshot().target.x).toBeGreaterThan(before)
    })

    it('depois de um erro o segundo tiro acerta e conta 2 tiros', () => {
        const round = readyRound()
        aimAt(round, 150, 220)
        round.observePinch(reading(150, 220, false), 200)
        runUntil(round, () => round.state !== 'rolling')
        round.observePinch(reading(100, 300, false), 1000)
        aimAt(round, 0, 300, 1100)
        round.observePinch(reading(0, 300, false), 1300)
        runUntil(round, () => round.state !== 'rolling')
        expect(round.state).toBe('hit')
        expect(round.snapshot().hitShots).toBe(2)
    })

    it('em hit, a pinça é ignorada; newRound zera tiros e posições', () => {
        const round = readyRound()
        aimAt(round, 0, 300)
        round.observePinch(reading(0, 300, false), 200)
        runUntil(round, () => round.state === 'hit')
        round.observePinch(reading(150, 300, true), 400)
        expect(round.state).toBe('hit')
        round.newRound()
        const snap = round.snapshot()
        expect(round.state).toBe('ready')
        expect(snap.shots).toBe(0)
        expect(snap.hitShots).toBeNull()
        expect(snap.shooter).toEqual({ x: 150, y: 300 })
        expect(snap.target).toEqual({ x: 550, y: 300 })
    })

    it('advance fora de rolling e hit não mexe nas bolinhas', () => {
        const round = readyRound()
        round.advance(500)
        expect(round.snapshot().shooter).toEqual({ x: 150, y: 300 })
        aimAt(round, 50, 300)
        round.advance(500)
        expect(round.snapshot().shooter).toEqual({ x: 150, y: 300 })
    })

    it('um intervalo enorme entre quadros é limitado e não trava', () => {
        const round = readyRound()
        aimAt(round, 0, 300)
        round.observePinch(reading(0, 300, false), 200)
        round.advance(10_000)
        expect(['rolling', 'hit', 'ready']).toContain(round.state)
    })

    it('newRound sem câmera pronta volta a idle', () => {
        const round = createBeteRound()
        round.newRound()
        expect(round.state).toBe('idle')
    })
})

describe('createBeteRound: modo estalo (alpha), mira relativa e gatilho rápido', () => {
    /** Leitura do estalo: `closed` significa armado; `release` só no quadro da soltura; o ponto está em coordenadas do campo. */
    const flick = (opts: {
        armed?: boolean
        visible?: boolean
        x?: number
        y?: number
        release?: FlickRelease | null
    }): FlickReading => {
        const visible = opts.visible ?? true
        const armed = visible && (opts.armed ?? false)
        return {
            handVisible: visible,
            closed: armed,
            ratio: visible ? (armed ? 0.2 : 0.8) : null,
            point: visible ? { x: (opts.x ?? 100) / W, y: (opts.y ?? 300) / H } : null,
            release: opts.release ?? null,
        }
    }
    const release = (overrides: Partial<FlickRelease> = {}): FlickRelease => ({
        fast: true,
        openSpeed: 40,
        riseMs: 12,
        ...overrides,
    })

    /** Rodada com a pinça aberta vista e armada em (100, 300); escala 1 mantém as contas em unidades do campo. */
    function armedRound(aimScale = 1) {
        const round = createBeteRound({ aimScale })
        round.cameraReady()
        round.observeFlick(flick({ armed: false }), 0)
        round.observeFlick(flick({ armed: true }), 16)
        return round
    }

    /** Arrasta a mão armada até o ponto dado. */
    function dragTo(round: ReturnType<typeof createBeteRound>, x: number, y: number, t = 32) {
        round.observeFlick(flick({ armed: true, x, y }), t)
    }

    it('arma ao fechar depois de vista aberta, em qualquer ponto, e a pinça virtual começa na bolinha', () => {
        const round = armedRound()
        expect(round.state).toBe('aiming')
        const snap = round.snapshot()
        expect(snap.aim?.pinch).toEqual({ x: 150, y: 300 })
        expect(snap.aim?.shot).toBeNull()
    })

    it('a mira é relativa: pinça virtual = bolinha + arrasto da mão vezes a escala', () => {
        const round = armedRound(1)
        dragTo(round, 40, 340)
        expect(round.snapshot().aim?.pinch).toEqual({ x: 90, y: 340 })

        const scaled = armedRound(2)
        dragTo(scaled, 40, 340)
        expect(scaled.snapshot().aim?.pinch).toEqual({ x: 30, y: 380 })
    })

    it('por padrão o arrasto vale 1,5 vez no campo, como no modo pinça', () => {
        const round = createBeteRound()
        round.cameraReady()
        round.observeFlick(flick({ armed: false }), 0)
        round.observeFlick(flick({ armed: true }), 16)
        dragTo(round, 0, 300)
        expect(round.snapshot().aim?.pinch.x).toBeCloseTo(150 - 100 * 1.5, 6)
    })

    it('a previsão do tiro é a mesma do modo pinça para o mesmo arrasto', () => {
        const pinch = readyRound()
        aimAt(pinch, 40, 340)
        const flickRound = armedRound(1)
        dragTo(flickRound, -10, 340)
        const fromPinch = pinch.snapshot().aim?.shot
        const fromFlick = flickRound.snapshot().aim?.shot
        expect(fromFlick).not.toBeNull()
        expect(fromFlick?.velocity.x).toBeCloseTo(fromPinch?.velocity.x ?? NaN, 6)
        expect(fromFlick?.velocity.y).toBeCloseTo(fromPinch?.velocity.y ?? NaN, 6)
    })

    it('uma pinça já armada ao aparecer não inicia a mira', () => {
        const round = createBeteRound()
        round.cameraReady()
        round.observeFlick(flick({ armed: true }), 0)
        round.observeFlick(flick({ armed: true }), 16)
        expect(round.state).toBe('ready')
        expect(round.snapshot().aim).toBeNull()
    })

    it('ignora o estalo enquanto a câmera não está pronta', () => {
        const round = createBeteRound()
        round.observeFlick(flick({ armed: false }), 0)
        round.observeFlick(flick({ armed: true }), 16)
        expect(round.state).toBe('idle')
    })

    it('abertura rápida com arrasto suficiente dispara: conta o tiro e a bolinha vai para o lado oposto ao arrasto', () => {
        const round = armedRound()
        dragTo(round, -20, 300)
        round.observeFlick(flick({ armed: false, x: -20, y: 300, release: release() }), 48)
        expect(round.state).toBe('rolling')
        expect(round.snapshot().shots).toBe(1)
        expect(round.snapshot().aim).toBeNull()
        round.advance(100)
        const { shooter } = round.snapshot()
        expect(shooter.x).toBeGreaterThan(150)
        expect(shooter.y).toBeCloseTo(300, 6)
    })

    it('a força vem do arrasto, não da velocidade de abertura', () => {
        const slowOpen = armedRound()
        dragTo(slowOpen, -20, 300)
        slowOpen.observeFlick(
            flick({ armed: false, x: -20, y: 300, release: release({ openSpeed: 2.5 }) }),
            48,
        )
        const fastOpen = armedRound()
        dragTo(fastOpen, -20, 300)
        fastOpen.observeFlick(
            flick({ armed: false, x: -20, y: 300, release: release({ openSpeed: 199 }) }),
            48,
        )
        slowOpen.advance(100)
        fastOpen.advance(100)
        expect(slowOpen.snapshot().shooter.x).toBeCloseTo(fastOpen.snapshot().shooter.x, 9)
    })

    it('arrasto suficiente e abertura rápida acertam o alvo', () => {
        const round = armedRound()
        dragTo(round, -20, 300)
        round.observeFlick(flick({ armed: false, x: -20, y: 300, release: release() }), 48)
        runUntil(round, () => round.state !== 'rolling')
        expect(round.state).toBe('hit')
        expect(round.snapshot().hitShots).toBe(1)
    })

    it('vale a última posição com a pinça fechada, não a do quadro da abertura', () => {
        const round = armedRound()
        dragTo(round, -20, 300)
        // A mão se mexe no quadro da abertura; a mira usada é a anterior.
        round.observeFlick(flick({ armed: false, x: 100, y: 500, release: release() }), 48)
        round.advance(100)
        expect(round.snapshot().shooter.y).toBeCloseTo(300, 6)
        expect(round.snapshot().shooter.x).toBeGreaterThan(150)
    })

    it('abertura lenta ou fraca cancela sem contar tiro', () => {
        const slow = armedRound()
        dragTo(slow, -20, 300)
        slow.observeFlick(
            flick({ armed: false, x: -20, y: 300, release: release({ fast: false, riseMs: 120 }) }),
            48,
        )
        expect(slow.state).toBe('ready')
        expect(slow.snapshot().shots).toBe(0)
        expect(slow.snapshot().aim).toBeNull()
    })

    it('abertura rápida com arrasto curto demais cancela sem contar tiro', () => {
        const round = armedRound()
        dragTo(round, 95, 300)
        round.observeFlick(flick({ armed: false, x: 95, y: 300, release: release() }), 48)
        expect(round.state).toBe('ready')
        expect(round.snapshot().shots).toBe(0)
    })

    it('abertura rápida sem nenhum arrasto cancela sem contar tiro', () => {
        const round = armedRound()
        round.observeFlick(flick({ armed: false, release: release() }), 48)
        expect(round.state).toBe('ready')
        expect(round.snapshot().shots).toBe(0)
    })

    it('erro: quando tudo para, a bolinha de tiro volta ao início e o jogador tenta de novo', () => {
        const round = armedRound()
        dragTo(round, 100, 150)
        round.observeFlick(flick({ armed: false, x: 100, y: 150, release: release() }), 48)
        runUntil(round, () => round.state !== 'rolling')
        expect(round.state).toBe('ready')
        expect(round.snapshot().shooter).toEqual({ x: 150, y: 300 })
        expect(round.snapshot().shots).toBe(1)
    })

    it('perder a mão por mais de 300 ms cancela; por menos, mantém', () => {
        const kept = armedRound()
        kept.observeFlick(flick({ visible: false }), 100)
        kept.observeFlick(flick({ armed: true }), 200)
        expect(kept.state).toBe('aiming')

        const lost = armedRound()
        lost.observeFlick(flick({ visible: false }), 100)
        lost.observeFlick(flick({ visible: false }), 400)
        expect(lost.state).toBe('ready')
        expect(lost.snapshot().shots).toBe(0)
        expect(lost.snapshot().aim).toBeNull()
    })

    it('se o detector zerou o armado (mão aberta, sem soltura), a mira é cancelada', () => {
        const round = armedRound()
        round.observeFlick(flick({ armed: false }), 32)
        expect(round.state).toBe('ready')
        expect(round.snapshot().shots).toBe(0)
    })

    it('enquanto as bolinhas rolam, o estalo é ignorado', () => {
        const round = armedRound()
        dragTo(round, -20, 300)
        round.observeFlick(flick({ armed: false, x: -20, y: 300, release: release() }), 48)
        round.observeFlick(flick({ armed: false }), 64)
        round.observeFlick(flick({ armed: true }), 80)
        expect(round.state).toBe('rolling')
    })

    it('o snapshot não tem mais a direção do estalo', () => {
        const round = armedRound()
        expect(round.snapshot()).not.toHaveProperty('flick')
    })
})
