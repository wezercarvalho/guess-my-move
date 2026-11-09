import { describe, expect, it } from 'vitest'

import { type BoardPlacement, HandRoleAssigner, type HandInput } from '../src/index.js'

const board: BoardPlacement = { x: 0.1, y: 0.3, width: 0.5, height: 0.4 }

/** Mão com 21 pontos, todos perto do pulso `(x, 0.6)`. */
function hand(wristX: number, handedness?: string): HandInput {
    const landmarks = Array.from({ length: 21 }, () => ({ x: wristX, y: 0.6 }))
    return handedness === undefined ? { landmarks } : { landmarks, handedness }
}

describe('papéis das mãos', () => {
    it('com duas mãos, a do lado da pestana é a do braço e a outra bate', () => {
        const left = hand(0.2)
        const right = hand(0.8)
        const roles = new HandRoleAssigner().assign([right, left], board, 0)
        expect(roles.fretting).toBe(left)
        expect(roles.strumming).toBe(right)
    })

    it('o resultado não muda com o rótulo certo, trocado ou ausente', () => {
        const run = (leftLabel?: string, rightLabel?: string) => {
            const left = hand(0.2, leftLabel)
            const right = hand(0.8, rightLabel)
            const roles = new HandRoleAssigner().assign([left, right], board, 0)
            return [roles.fretting === left, roles.strumming === right]
        }
        expect(run('Left', 'Right')).toEqual([true, true])
        expect(run('Right', 'Left')).toEqual([true, true])
        expect(run(undefined, undefined)).toEqual([true, true])
    })

    it('canhoto inverte os lados', () => {
        const left = hand(0.2)
        const right = hand(0.8)
        const roles = new HandRoleAssigner().assign([left, right], { ...board, leftHanded: true }, 0)
        expect(roles.fretting).toBe(right)
        expect(roles.strumming).toBe(left)
    })

    it('com uma mão, decide pelo lado da divisa', () => {
        const assigner = new HandRoleAssigner()
        const nearNut = hand(0.2)
        expect(assigner.assign([nearNut], board, 0)).toEqual({ fretting: nearNut, strumming: null })
        const farSide = hand(0.85)
        expect(assigner.assign([farSide], board, 0)).toEqual({ fretting: null, strumming: farSide })
    })

    it('uma mão parada na divisa mantém o papel que tinha', () => {
        const assigner = new HandRoleAssigner()
        const split = board.x + board.width
        const before = hand(split - 0.2)
        assigner.assign([before], board, 0)
        // oscila em volta da divisa, dentro da margem: continua com o braço
        for (const wristX of [split - 0.01, split + 0.01, split - 0.015, split + 0.02]) {
            const roles = assigner.assign([hand(wristX)], board, 0)
            expect(roles.fretting).not.toBeNull()
            expect(roles.strumming).toBeNull()
        }
    })

    it('sem mãos, devolve os dois papéis vazios', () => {
        expect(new HandRoleAssigner().assign([], board, 0)).toEqual({ fretting: null, strumming: null })
    })

    it('após uma ausência longa não reutiliza o papel anterior na margem', () => {
        const assigner = new HandRoleAssigner()
        const split = board.x + board.width
        const boundary = hand(split + 0.01)
        assigner.assign([hand(split - 0.1)], board, 0)
        assigner.assign([], board, 100)
        expect(assigner.assign([boundary], board, 150).fretting).toBe(boundary)
        assigner.assign([], board, 250)
        expect(assigner.assign([boundary], board, 301).strumming).toBe(boundary)
    })

    it('um intervalo longo sem chamadas também expira o papel anterior', () => {
        const assigner = new HandRoleAssigner()
        const split = board.x + board.width
        const boundary = hand(split - 0.01)
        assigner.assign([hand(split + 0.1)], board, 0)
        expect(assigner.assign([boundary], board, 151).fretting).toBe(boundary)
    })

    it('com mais de duas mãos usa as duas das pontas', () => {
        const a = hand(0.1)
        const b = hand(0.5)
        const c = hand(0.9)
        const roles = new HandRoleAssigner().assign([b, c, a], board, 0)
        expect(roles.fretting).toBe(a)
        expect(roles.strumming).toBe(c)
    })
})
