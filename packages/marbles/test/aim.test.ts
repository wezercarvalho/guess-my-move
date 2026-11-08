import { describe, expect, it } from 'vitest'

import aimSource from '../src/aim/index.ts?raw'
import { DEFAULT_SHOT } from '../src/shot.js'
import { type FlickReading, type FlickRelease } from '../src/flick.js'
import { type PinchReading } from '../src/pinch.js'
import { createAimController } from '../src/aim/index.js'

const W = 800
const H = 600
const SHOOTER = { x: 150, y: 300 }

/** Leitura da pinça com o ponto dado em coordenadas do campo. */
const reading = (x: number, y: number, closed: boolean): PinchReading => ({
    handVisible: true,
    closed,
    ratio: closed ? 0.2 : 0.8,
    point: { x: x / W, y: y / H },
})
const noHand: PinchReading = { handVisible: false, closed: false, ratio: null, point: null }

/** Controlador pronto, com a pinça aberta já observada; escala 1 mantém as contas em unidades do campo. */
function readyAim() {
    return createAimController({ width: W, height: H, shot: DEFAULT_SHOT, aimScale: 1, lostHandMs: 300 })
}

describe('createAimController: pinça', () => {
    it('a pinça fechada em qualquer ponto inicia a mira, sem exigir proximidade da bolinha', () => {
        const aim = readyAim()
        aim.observePinch(SHOOTER, reading(100, 300, false), 0)
        const out = aim.observePinch(SHOOTER, reading(700, 500, true), 16)
        expect(out.aiming?.kind).toBe('pinch')
        expect(out.fired).toBeNull()
    })

    it('a mira é relativa: só o arrasto importa, não o ponto onde a pinça fechou', () => {
        const near = readyAim()
        near.observePinch(SHOOTER, reading(100, 300, false), 0)
        near.observePinch(SHOOTER, reading(150, 300, true), 100)
        const nearOut = near.observePinch(SHOOTER, reading(50, 300, true), 116)

        const far = readyAim()
        far.observePinch(SHOOTER, reading(100, 300, false), 0)
        far.observePinch(SHOOTER, reading(700, 500, true), 100)
        const farOut = far.observePinch(SHOOTER, reading(600, 500, true), 116)

        expect(farOut.aiming?.shot?.velocity.x).toBeCloseTo(
            nearOut.aiming?.shot?.velocity.x ?? Number.NaN,
            6,
        )
        expect(farOut.aiming?.shot?.velocity.y).toBeCloseTo(0, 9)
    })

    it('a pinça virtual é a bolinha mais o arrasto', () => {
        const aim = readyAim()
        aim.observePinch(SHOOTER, reading(100, 300, false), 0)
        aim.observePinch(SHOOTER, reading(700, 500, true), 100)
        const out = aim.observePinch(SHOOTER, reading(660, 470, true), 116)
        expect(out.aiming?.pinch.x).toBeCloseTo(150 - 40, 6)
        expect(out.aiming?.pinch.y).toBeCloseTo(300 - 30, 6)
    })

    it('a escala multiplica o arrasto no campo', () => {
        const aim = createAimController({ width: W, height: H, shot: DEFAULT_SHOT, aimScale: 1.5, lostHandMs: 300 })
        aim.observePinch(SHOOTER, reading(400, 300, false), 0)
        aim.observePinch(SHOOTER, reading(400, 300, true), 100)
        const out = aim.observePinch(SHOOTER, reading(300, 300, true), 116)
        expect(out.aiming?.shot?.pull).toBeCloseTo(150, 6)
        expect(out.aiming?.shot?.velocity.x).toBeCloseTo(750, 6)
    })

    it('só inicia ao fechar: uma pinça já fechada ao aparecer não inicia a mira', () => {
        const aim = readyAim()
        aim.observePinch(SHOOTER, reading(400, 100, true), 0)
        const out = aim.observePinch(SHOOTER, reading(400, 100, true), 16)
        expect(out.aiming).toBeNull()
    })

    it('soltar com arrasto suficiente dispara e devolve o tiro', () => {
        const aim = readyAim()
        aim.observePinch(SHOOTER, reading(100, 300, false), 0)
        aim.observePinch(SHOOTER, reading(150, 300, true), 100)
        aim.observePinch(SHOOTER, reading(0, 300, true), 116)
        const out = aim.observePinch(SHOOTER, reading(0, 300, false), 200)
        expect(out.fired).not.toBeNull()
        expect(out.fired?.x).toBeGreaterThan(0)
        expect(out.aiming).toBeNull()
    })

    it('soltar com arrasto curto cancela sem disparar', () => {
        const aim = readyAim()
        aim.observePinch(SHOOTER, reading(100, 300, false), 0)
        aim.observePinch(SHOOTER, reading(150, 300, true), 100)
        aim.observePinch(SHOOTER, reading(140, 300, true), 116)
        const out = aim.observePinch(SHOOTER, reading(140, 300, false), 200)
        expect(out.fired).toBeNull()
        expect(out.aiming).toBeNull()
    })

    it('perder a mão por mais do que a tolerância cancela a mira', () => {
        const aim = readyAim()
        aim.observePinch(SHOOTER, reading(100, 300, false), 0)
        aim.observePinch(SHOOTER, reading(150, 300, true), 100)
        aim.observePinch(SHOOTER, reading(50, 300, true), 116)
        const kept = aim.observePinch(SHOOTER, noHand, 300)
        expect(kept.aiming).not.toBeNull()
        const lost = aim.observePinch(SHOOTER, noHand, 450)
        expect(lost.aiming).toBeNull()
        expect(lost.fired).toBeNull()
    })

    it('cancelar zera a mira em andamento', () => {
        const aim = readyAim()
        aim.observePinch(SHOOTER, reading(100, 300, false), 0)
        aim.observePinch(SHOOTER, reading(150, 300, true), 100)
        aim.observePinch(SHOOTER, reading(50, 300, true), 116)
        aim.cancel()
        const out = aim.observePinch(SHOOTER, reading(50, 300, true), 132)
        expect(out.aiming).toBeNull()
    })
})

describe('createAimController: estalo (alpha)', () => {
    const ANCHOR = { x: 0.25, y: 0.5 }
    const PULL_LEFT = { x: 0.15, y: 0.5 }

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

    function aimingFlick() {
        const aim = readyAim()
        aim.observeFlick(SHOOTER, flick({ armed: true }), 0)
        aim.observeFlick(SHOOTER, flick({ armed: true, at: PULL_LEFT }), 16)
        return aim
    }

    it('arma assim que a mão está armada e a seta segue o deslocamento', () => {
        const aim = aimingFlick()
        const out = aim.observeFlick(SHOOTER, flick({ armed: true, at: PULL_LEFT }), 32)
        expect(out.aiming?.kind).toBe('flick')
        expect(out.aiming?.direction?.x).toBeCloseTo(1, 9)
        expect(out.aiming?.direction?.y).toBeCloseTo(0, 9)
    })

    it('estalo confirmado dispara na direção travada, com a força do polegar', () => {
        const aim = aimingFlick()
        const out = aim.observeFlick(
            SHOOTER,
            flick({ armed: false, at: { x: 0.9, y: 0.9 }, release: release({ openSpeed: 8 }) }),
            48,
        )
        expect(out.fired).not.toBeNull()
        expect(out.fired?.x).toBeGreaterThan(0)
        expect(out.fired?.y).toBeCloseTo(0, 6)
        expect(out.aiming).toBeNull()
    })

    it('estalo fraco, não sustentado ou mão aberta cancela sem disparar', () => {
        for (const verdict of ['weak', 'unsustained', 'open_hand'] as const) {
            const aim = aimingFlick()
            const out = aim.observeFlick(SHOOTER, flick({ armed: false, release: release({ verdict }) }), 48)
            expect(out.fired).toBeNull()
            expect(out.aiming).toBeNull()
        }
    })

    it('uma mão esticada, sem armar, não inicia a mira', () => {
        const aim = readyAim()
        aim.observeFlick(SHOOTER, flick({ armed: false }), 0)
        const out = aim.observeFlick(SHOOTER, flick({ armed: false }), 16)
        expect(out.aiming).toBeNull()
    })
})

describe('createAimController: pureza', () => {
    it('o módulo não importa physics.ts nem round.ts', () => {
        const imports = aimSource.match(/from\s+'[^']+'/g) ?? []
        for (const line of imports) {
            expect(line).not.toMatch(/physics/)
            expect(line).not.toMatch(/round/)
        }
    })
})

