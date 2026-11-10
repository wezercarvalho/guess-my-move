import { describe, expect, it } from 'vitest'
import { SwingPreparation, isPositive, faceUsable } from '../src/preparation.js'
import type { FaceReading } from '../src/headLook.js'
import type { HandPoint } from '../src/pose.js'
const face = (yaw = 0, pitch = 0): FaceReading => ({
    orientation: { yaw, pitch },
    landmarks: [
        { x: 0.4, y: 0.3 },
        { x: 0.6, y: 0.7 },
    ],
})
export function palm(positive = false): HandPoint[] {
    const points = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5 }))
    points[0] = { x: 0.5, y: 0.8 }
    for (const [base, tip, x] of [
        [5, 8, 0.4],
        [9, 12, 0.5],
        [13, 16, 0.6],
        [17, 20, 0.7],
    ]) {
        points[base] = { x: x, y: 0.6 }
        points[tip] = { x: x, y: positive ? 0.62 : 0.25 }
    }
    points[2] = { x: 0.35, y: 0.65 }
    points[3] = { x: 0.35, y: 0.48 }
    points[4] = { x: 0.35, y: positive ? 0.25 : 0.5 }
    return points
}
describe('preparação guiada', () => {
    it('positivo exige polegar vertical e quatro dedos fechados', () => {
        expect(isPositive(palm(true))).toBe(true)
        expect(isPositive(palm())).toBe(false)
        const side = palm(true)
        side[4] = { x: 0.1, y: 0.65 }
        expect(isPositive(side)).toBe(false)
        expect(isPositive([])).toBe(false)
        side[4] = { x: NaN, y: 0.2 }
        expect(isPositive(side)).toBe(false)
    })
    it('rosto precisa enquadramento e matriz válida', () => {
        expect(faceUsable(face())).toBe(true)
        expect(faceUsable({ ...face(), orientation: null })).toBe(false)
        expect(
            faceUsable({ ...face(), landmarks: [{ x: -0.1, y: 0.4 }] }),
        ).toBe(false)
    })
    it('frames repetidos não calibram; face ausente reinicia', () => {
        const p = new SwingPreparation()
        for (let i = 0; i < 30; i++)
            p.sample({ at: 0, face: face(), hands: [] })
        expect(p.view.step).toBe('face')
        for (let i = 1; i <= 20; i++)
            p.sample({ at: i * 60, face: face(), hands: [] })
        expect(p.view.step).toBe('left')
        p.sample({ at: 1300, face: null, hands: [] })
        expect(p.view.step).toBe('face')
    })
    it('confere sentidos invertidos e retorna ao centro antes das mãos', () => {
        const p = new SwingPreparation()
        let at = 0
        const hold = (f: FaceReading, n = 12) => {
            for (let i = 0; i < n; i++)
                p.sample({ at: (at += 60), face: f, hands: [] })
        }
        hold(face(), 21)
        hold(face(0.2))
        hold(face())
        hold(face(-0.2))
        hold(face())
        hold(face(0, -0.2))
        hold(face())
        hold(face(0, 0.2))
        hold(face())
        expect(p.view.step).toBe('hands')
        expect(p.correct({ yaw: 0.2, pitch: -0.2 })).toEqual({
            yaw: -0.2,
            pitch: 0.2,
        })
    })
    it('consome positivo apenas após preparar e soltar; libera com palma neutra', () => {
        const p = new SwingPreparation()
        p.configure('hands', 1)
        let at = 0
        const hold = (h: HandPoint[], n: number) => {
            for (let i = 0; i < n; i++)
                p.sample({ at: (at += 60), face: null, hands: [h] })
        }
        hold(palm(true), 20)
        expect(p.view.step).toBe('hands')
        hold(palm(), 12)
        expect(p.view.step).toBe('confirm')
        hold(palm(true), 15)
        expect(p.view.step).toBe('release')
        hold(palm(true), 20)
        expect(p.view.ready).toBe(false)
        hold(palm(), 5)
        expect(p.view.ready).toBe(true)
        p.sample({ at: (at += 60), face: null, hands: [] })
        expect(p.view.ready).toBe(false)
    })
    it('teclado exige confirmação explícita e não exige câmera', () => {
        const p = new SwingPreparation()
        p.configure('keyboard', 1)
        expect(p.view.ready).toBe(false)
        p.confirmKeyboard()
        expect(p.view.ready).toBe(true)
        p.restart()
        expect(p.view.ready).toBe(false)
    })
    it('duas mãos precisam aparecer juntas e stale não confirma', () => {
        const p = new SwingPreparation()
        p.configure('hands', 2)
        for (let at = 0; at < 1200; at += 60)
            p.sample({ at, face: null, hands: [palm()] })
        expect(p.view.step).toBe('hands')
        p.sample({ at: 2000, face: null, hands: [palm(), palm()] })
        p.expire(2400)
        expect(p.view.progress).toBe(0)
    })
})

it('reiniciar no meio da conferência não dispensa os sentidos restantes', () => {
    const p = new SwingPreparation()
    for (let at = 0; at <= 1200; at += 60)
        p.sample({ at, face: face(), hands: [] })
    expect(p.view.step).toBe('left')
    p.restart()
    expect(p.view.step).toBe('face')
})

it('não confirma um sentido alternando lados durante a janela',()=>{
    const p=new SwingPreparation();let at=0
    for(let i=0;i<22;i++)p.sample({at:at+=60,face:face(),hands:[]})
    for(let i=0;i<20;i++)p.sample({at:at+=60,face:face(i%2?.2:-.2),hands:[]})
    expect(p.view.step).toBe('left')
})
