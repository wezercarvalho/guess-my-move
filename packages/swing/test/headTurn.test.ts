import { describe, expect, it } from 'vitest'
import { createHeadTurn, DEFAULT_HEAD_TURN } from '../src/headTurn.js'
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

describe('aceleração por permanência lateral', () => {
    it.each([-1, 1])('acelera só após 2,5 s totais, progressivamente e com teto no sentido %s', (sign) => {
        const turn = createHeadTurn()
        const input = {...side(sign * 0.4), sensitivity:3}
        turn.update(input, 100)
        let state = turn.update(input, 100)
        for (let elapsed = 200; elapsed <= 2500; elapsed += 100) state = turn.update(input, 100)
        expect(state.speedMultiplier).toBe(1)
        expect(Math.abs(state.yawDelta)).toBeCloseTo(Math.PI / 2 * 0.1)
        state = turn.update(input, 100)
        expect(state.speedMultiplier).toBeCloseTo(1.04)
        expect(Math.abs(state.yawDelta)).toBeGreaterThan(Math.PI / 2 * 0.1)
        for (let i = 0; i < 40; i++) state = turn.update(input, 100)
        expect(state.speedMultiplier).toBe(2)
        expect(state.yawDelta).toBeCloseTo(sign * Math.PI * 0.1)
    })
    it('descarta aceleração em centro, inatividade, perda de amostras, troca e reset', () => {
        const turn = createHeadTurn()
        const accelerate = () => { for (let i=0;i<55;i++) turn.update(side(),100) }
        accelerate()
        expect(turn.update(side(0),16).speedMultiplier).toBe(1)
        accelerate()
        expect(turn.update(side(-0.4),16).speedMultiplier).toBe(1)
        accelerate()
        expect(turn.update(side(0.4,true,false),16).speedMultiplier).toBe(1)
        accelerate()
        for(let i=0;i<4;i++) turn.update(side(0.4,false),100)
        expect(turn.update(side(),16).speedMultiplier).toBe(1)
        accelerate(); turn.reset()
        expect(turn.update(side(),16).speedMultiplier).toBe(1)
        accelerate()
        expect(turn.update(side(),2000).speedMultiplier).toBe(1)
    })
    it('acumula a mesma rotação extra com frames válidos de 20 e 100 ms', () => {
        function extra(step:number) {
            const turn = createHeadTurn()
            const plain = createHeadTurn({...DEFAULT_HEAD_TURN,maxSpeedMultiplier:1})
            turn.update(side(),step); plain.update(side(),step)
            let sum=0
            for(let elapsed=step;elapsed<=6000;elapsed+=step)
                sum+=turn.update(side(),step).yawDelta-plain.update(side(),step).yawDelta
            return sum
        }
        expect(extra(20)).toBeCloseTo(67.5 * Math.PI / 180,8)
        expect(extra(100)).toBeCloseTo(extra(20),8)
    })
})
