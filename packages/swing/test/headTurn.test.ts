import { describe, expect, it } from 'vitest'
import { createHeadTurn } from '../src/headTurn.js'
const side = (yaw=0.4, fresh=true, active=true) => ({yaw, fresh, active, sensitivity:1})
describe('giro contínuo pelo rosto', () => {
    it.each([-1,1])('espera 1 s para girar na direção %s', (sign) => {
        const turn=createHeadTurn()
        let state=turn.update(side(sign*0.4),100)
        for(let i=0;i<9;i++) state=turn.update(side(sign*0.4),100)
        expect(state.turning).toBe(false)
        expect(state.yawDelta).toBe(0)
        state=turn.update(side(sign*0.4),100)
        expect(state.turning).toBe(true)
        expect(state.yawDelta).toBeCloseTo(sign*Math.PI/6*0.1)
    })
    it('centro, perda, inatividade, troca de lado e reset zeram espera', () => {
        const turn=createHeadTurn()
        for(let i=0;i<12;i++) turn.update(side(),100)
        expect(turn.update(side(0),16).intent).toBeNull()
        for(let i=0;i<12;i++) turn.update(side(),100)
        expect(turn.update(side(0.4,true,false),16).turning).toBe(false)
        for(let i=0;i<12;i++) turn.update(side(),100)
        expect(turn.update(side(-0.4),16).progress).toBe(0)
        turn.reset()
        expect(turn.update(side(),16).progress).toBe(0)
    })
    it('uma imagem repetida ou um frame longo não iniciam giro', () => {
        const turn=createHeadTurn()
        turn.update(side(),16)
        for(let i=0;i<100;i++) expect(turn.update(side(0.4,false),16).turning).toBe(false)
        expect(turn.update(side(),2000).turning).toBe(false)
    })
    it('ganho muda taxa, não muda limiar ou espera; pitch não faz parte do giro', () => {
        const turn=createHeadTurn()
        for(let i=0;i<11;i++) turn.update(side(),100)
        expect(turn.update({...side(),sensitivity:3},100).yawDelta).toBeCloseTo(Math.PI/2*0.1)
        expect(turn.update({...side(),sensitivity:0.5},100).yawDelta).toBeCloseTo(Math.PI/12*0.1)
    })
})
