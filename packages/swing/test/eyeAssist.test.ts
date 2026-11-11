import { describe, expect, it } from 'vitest'
import {
    EyeAssist,
    eyeFeatures,
    EYE_TARGETS,
    EYE_VALIDATION,
} from '../src/eyeAssist.js'
import type { FaceReading } from '../src/headLook.js'
function eyes(x = 0.5, y = 0.5): FaceReading {
    const landmarks = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }))
    for (const [a, b, up, down, iris, cx] of [
        [33, 133, 159, 145, 468, 0.35],
        [362, 263, 386, 374, 473, 0.65],
    ]) {
        landmarks[a] = { x: cx - 0.05, y: 0.4 }
        landmarks[b] = { x: cx + 0.05, y: 0.4 }
        landmarks[up] = { x: cx, y: 0.38 }
        landmarks[down] = { x: cx, y: 0.42 }
        landmarks[iris] = {
            x: cx + (x - 0.5) * 0.05,
            y: 0.4 + (y - 0.5) * 0.025,
        }
    }
    return { landmarks, orientation: { yaw: 0, pitch: 0 } }
}
function calibrate(e: EyeAssist) {
    let at = 0
    e.enable(true)
    for (const point of [...EYE_TARGETS, ...EYE_VALIDATION]) {
        for (let i = 0; i < 24; i++)
            e.sample(eyes(point.x, point.y), (at += 60))
    }
    return at
}
describe('assistência ocular alpha', () => {
    it('não coleta desligada e rejeita piscada/incompleto', () => {
        const e = new EyeAssist()
        e.sample(eyes(), 100)
        expect(e.view.phase).toBe('off')
        expect(
            eyeFeatures({ landmarks: [], orientation: { yaw: 0, pitch: 0 } }),
        ).toBeNull()
        const f = eyes()
        f.landmarks[159].y = 0.42
        expect(eyeFeatures(f)).toBeNull()
    })
    it('calibra e valida alvos distintos, limita correção e não acumula giro', () => {
        const e = new EyeAssist()
        let at = calibrate(e)
        expect(e.view.phase).toBe('ready')
        let offset = { yaw: 0, pitch: 0 }
        for (let i = 0; i < 60; i++) {
            e.sample(eyes(0.8, 0.5), (at += 60))
            offset = e.update(at, 0.06, true, () => true)
        }
        expect(offset.yaw).toBeGreaterThan(0)
        expect(offset.yaw).toBeLessThanOrEqual((6 * Math.PI) / 180)
        const before = offset.yaw
        for (let i = 0; i < 60; i++) {
            e.sample(eyes(0.8, 0.5), (at += 60))
            offset = e.update(at, 0.06, true, () => true)
        }
        expect(offset.yaw).toBeCloseTo(before, 4)
        for (let i = 0; i < 30; i++)
            offset = e.update((at += 60), 0.06, false, () => true)
        expect(Math.abs(offset.yaw)).toBeLessThan(0.001)
    })
    it('rejeita calibração sem variação e não aceita imagem congelada', () => {
        const e = new EyeAssist()
        e.enable(true)
        for (let i = 0; i < 100; i++) e.sample(eyes(), 0)
        expect(e.view.index).toBe(0)
        for (let i = 1; i < 500; i++) e.sample(eyes(), i * 60)
        expect(e.view.phase).toBe('failed')
    })
    it('HUD, pose extrema, perda e desativação retiram contribuição', () => {
        const e = new EyeAssist()
        let at = calibrate(e)
        for (let i = 0; i < 30; i++) {
            e.sample(eyes(0.8, 0.5), (at += 60))
            e.update(at, 0.06, true, () => true)
        }
        for (let i = 0; i < 30; i++) {
            e.sample(eyes(0.8, 0.5), (at += 60))
            e.update(at, 0.06, true, () => false)
        }
        expect(
            Math.abs(e.update(at, 0.06, true, () => false).yaw),
        ).toBeLessThan(0.001)
        const tilted = eyes(0.8, 0.5)
        tilted.orientation!.yaw = 0.4
        e.sample(tilted, (at += 60))
        expect(e.view.usable).toBe(false)
        e.enable(false)
        expect(e.view.phase).toBe('off')
        e.invalidate()
        expect(e.view.phase).toBe('off')
    })
})

it('normaliza translação, escala e inclinação comum sem somar movimento da cabeça', () => {
    const f=eyes(.7,.6), before=eyeFeatures(f)
    const angle=.1,scale=.8
    const moved={...f,orientation:{yaw:.05,pitch:.04},landmarks:f.landmarks.map(p=>({x:.5+scale*((p.x-.5)*Math.cos(angle)-(p.y-.5)*Math.sin(angle)),y:.5+scale*((p.x-.5)*Math.sin(angle)+(p.y-.5)*Math.cos(angle))}))}
    const after=eyeFeatures(moved)
    expect(after?.x).toBeCloseTo(before!.x,8)
    expect(after?.y).toBeCloseTo(before!.y,8)
})

it('rejeita erro nos alvos de validação mesmo após ajuste matemático válido',()=>{
    const e=new EyeAssist();let at=0;e.enable(true)
    for(const point of EYE_TARGETS)for(let i=0;i<24;i++)e.sample(eyes(point.x,point.y),at+=60)
    for(const point of EYE_VALIDATION)for(let i=0;i<24;i++)e.sample(eyes(1-point.x,1-point.y),at+=60)
    expect(e.view.phase).toBe('failed')
    expect(e.view.error).toBeGreaterThan(.18)
})
