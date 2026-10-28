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

describe('createBeteRound: modo estalo (alpha)', () => {
    /** Onde a mão arma: (200, 300) no campo de 800 x 600. */
    const ANCHOR = { x: 0.25, y: 0.5 }
    /** 80 unidades à esquerda do ponto de armar: com o ganho de 1,5, um arrasto de 120 que atira para a direita (alvo). */
    const PULL_LEFT = { x: 0.15, y: 0.5 }

    /** Leitura do estalo: `armed` é a mão armada, `pending` é a confirmação do polegar esticado; `release` só no quadro da soltura. */
    const flick = (opts: {
        armed?: boolean
        pending?: boolean
        visible?: boolean
        at?: { x: number; y: number }
        release?: FlickRelease | null
    }): FlickReading => {
        const visible = opts.visible ?? true
        const armed = visible && (opts.armed ?? false)
        return {
            handVisible: visible,
            closed: armed,
            phase: armed ? (opts.pending ? 'pending' : 'armed') : 'idle',
            gesture: null,
            ratio: visible ? (armed ? 0.8 : 1.4) : null,
            point: visible ? (opts.at ?? ANCHOR) : null,
            release: opts.release ?? null,
        }
    }
    const release = (overrides: Partial<FlickRelease> = {}): FlickRelease => ({
        verdict: 'confirmed',
        openSpeed: 8,
        riseMs: 67,
        point: PULL_LEFT,
        ...overrides,
    })

    /** Mão armada no ponto de armar e já puxada para a esquerda. */
    function aimingRound() {
        const round = createBeteRound()
        round.cameraReady()
        round.observeFlick(flick({ armed: true }), 0)
        round.observeFlick(flick({ armed: true, at: PULL_LEFT }), 16)
        return round
    }

    it('arma assim que a mão está armada, sem exigir a pinça vista aberta, e ainda sem arrasto não há seta', () => {
        const round = createBeteRound()
        round.cameraReady()
        round.observeFlick(flick({ armed: true }), 0)
        expect(round.state).toBe('aiming')
        expect(round.snapshot().flick).toBeNull()
        expect(round.snapshot().aim).toBeNull()
    })

    it('a seta acompanha o deslocamento da mão, como o estilingue da pinça, e não há elástico', () => {
        const round = aimingRound()
        const snap = round.snapshot()
        expect(snap.flick?.direction.x).toBeCloseTo(1, 9)
        expect(snap.flick?.direction.y).toBeCloseTo(0, 9)
        expect(snap.aim).toBeNull()

        round.observeFlick(flick({ armed: true, at: { x: 0.25, y: 0.3 } }), 32)
        const up = round.snapshot().flick?.direction
        expect(up?.x).toBeCloseTo(0, 9)
        expect(up?.y).toBeCloseTo(1, 9)
    })

    it('sem arrasto suficiente (abaixo de 30 unidades) não há seta', () => {
        const round = createBeteRound()
        round.cameraReady()
        round.observeFlick(flick({ armed: true }), 0)
        round.observeFlick(flick({ armed: true, at: { x: 0.2375, y: 0.5 } }), 16)
        expect(round.snapshot().flick).toBeNull()
    })

    it('uma mão esticada, sem armar, não inicia a mira', () => {
        const round = createBeteRound()
        round.cameraReady()
        round.observeFlick(flick({ armed: false }), 0)
        round.observeFlick(flick({ armed: false }), 16)
        expect(round.state).toBe('ready')
    })

    it('ignora o estalo enquanto a câmera não está pronta', () => {
        const round = createBeteRound()
        round.observeFlick(flick({ armed: true }), 0)
        expect(round.state).toBe('idle')
    })

    it('durante a confirmação do polegar a mão perturbada não mexe na mira', () => {
        const round = aimingRound()
        round.observeFlick(flick({ armed: true, pending: true, at: { x: 0.9, y: 0.9 } }), 48)
        const direction = round.snapshot().flick?.direction
        expect(direction?.x).toBeCloseTo(1, 9)
        expect(direction?.y).toBeCloseTo(0, 9)
    })

    it('estalo confirmado dispara: conta o tiro e a bolinha vai na direção da mira, travada antes do polegar subir', () => {
        const round = aimingRound()
        // No quadro da soltura a mão já foi parar longe, mas a mira vale a posição travada.
        round.observeFlick(
            flick({ armed: false, at: { x: 0.9, y: 0.9 }, release: release({ openSpeed: 8 }) }),
            48,
        )
        expect(round.state).toBe('rolling')
        expect(round.snapshot().shots).toBe(1)
        expect(round.snapshot().flick).toBeNull()
        round.advance(100)
        const { shooter } = round.snapshot()
        expect(shooter.x).toBeGreaterThan(150)
        expect(shooter.y).toBeCloseTo(300, 6)
    })

    it('a força vem do polegar e não do arrasto: arrastar mais não muda a velocidade', () => {
        const short = aimingRound()
        short.observeFlick(flick({ armed: false, release: release({ openSpeed: 12 }) }), 48)
        const long = createBeteRound()
        long.cameraReady()
        long.observeFlick(flick({ armed: true }), 0)
        const far = { x: 0.05, y: 0.5 }
        long.observeFlick(flick({ armed: true, at: far }), 16)
        long.observeFlick(flick({ armed: false, release: release({ openSpeed: 12, point: far }) }), 48)
        short.advance(100)
        long.advance(100)
        expect(long.snapshot().shooter.x).toBeCloseTo(short.snapshot().shooter.x, 9)
    })

    it('a força vem da velocidade com que o polegar estica: fraca não chega ao alvo e forte acerta', () => {
        const weak = aimingRound()
        weak.observeFlick(flick({ armed: false, release: release({ openSpeed: 4 }) }), 48)
        runUntil(weak, () => weak.state !== 'rolling')
        expect(weak.state).toBe('ready')

        const strong = aimingRound()
        strong.observeFlick(flick({ armed: false, release: release({ openSpeed: 20 }) }), 48)
        runUntil(strong, () => strong.state !== 'rolling')
        expect(strong.state).toBe('hit')
        expect(strong.snapshot().hitShots).toBe(1)
    })

    it('estalo fraco, não sustentado ou mão aberta cancela sem contar tiro', () => {
        for (const verdict of ['weak', 'unsustained', 'open_hand'] as const) {
            const round = aimingRound()
            round.observeFlick(flick({ armed: false, release: release({ verdict }) }), 48)
            expect(round.state).toBe('ready')
            expect(round.snapshot().shots).toBe(0)
            expect(round.snapshot().flick).toBeNull()
        }
    })

    it('estalo confirmado sem arrasto suficiente cancela, sem contar tiro', () => {
        const round = createBeteRound()
        round.cameraReady()
        round.observeFlick(flick({ armed: true }), 0)
        round.observeFlick(flick({ armed: false, release: release({ point: ANCHOR }) }), 48)
        expect(round.state).toBe('ready')
        expect(round.snapshot().shots).toBe(0)
    })

    it('erro: a bolinha de tiro volta ao início e o jogador tenta de novo', () => {
        const round = createBeteRound()
        round.cameraReady()
        round.observeFlick(flick({ armed: true }), 0)
        const up = { x: 0.25, y: 0.3 }
        round.observeFlick(flick({ armed: false, release: release({ point: up }) }), 48)
        runUntil(round, () => round.state !== 'rolling')
        expect(round.state).toBe('ready')
        expect(round.snapshot().shooter).toEqual({ x: 150, y: 300 })
        expect(round.snapshot().shots).toBe(1)
    })

    it('perder a mão por mais de 300 ms cancela; por menos, mantém', () => {
        const kept = aimingRound()
        kept.observeFlick(flick({ visible: false }), 100)
        kept.observeFlick(flick({ armed: true, at: PULL_LEFT }), 200)
        expect(kept.state).toBe('aiming')

        const lost = aimingRound()
        lost.observeFlick(flick({ visible: false }), 100)
        lost.observeFlick(flick({ visible: false }), 400)
        expect(lost.state).toBe('ready')
        expect(lost.snapshot().shots).toBe(0)
    })

    it('se o detector zerou o armado sem soltura (mão esticada), a mira é cancelada', () => {
        const round = aimingRound()
        round.observeFlick(flick({ armed: false }), 32)
        expect(round.state).toBe('ready')
        expect(round.snapshot().shots).toBe(0)
    })

    it('enquanto as bolinhas rolam, o estalo é ignorado', () => {
        const round = aimingRound()
        round.observeFlick(flick({ armed: false, release: release() }), 48)
        round.observeFlick(flick({ armed: false }), 64)
        round.observeFlick(flick({ armed: true }), 80)
        expect(round.state).toBe('rolling')
    })

    it('no modo pinça o snapshot não tem seta de estalo', () => {
        const round = readyRound()
        aimAt(round, 50, 300)
        expect(round.snapshot().flick).toBeNull()
        expect(round.snapshot().aim).not.toBeNull()
    })
})
