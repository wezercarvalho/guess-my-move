import { describe, expect, it } from 'vitest'

import { createWebTrigger } from '../src/trigger.js'

const love = { name: 'ILoveYou', score: 0.9 }

describe('createWebTrigger', () => {
    it('só lança depois de dois quadros seguidos com o gesto', () => {
        const trigger = createWebTrigger()
        expect(trigger.update(love, 0)).toBe(false)
        expect(trigger.update(love, 33)).toBe(true)
    })

    it('ignora o gesto com pontuação baixa e outros gestos', () => {
        const trigger = createWebTrigger()
        expect(trigger.update({ name: 'ILoveYou', score: 0.6 }, 0)).toBe(false)
        expect(trigger.update({ name: 'ILoveYou', score: 0.6 }, 33)).toBe(false)
        expect(trigger.update({ name: 'Open_Palm', score: 0.99 }, 66)).toBe(false)
        expect(trigger.update({ name: 'Open_Palm', score: 0.99 }, 99)).toBe(false)
    })

    it('um quadro isolado entre falhas não lança', () => {
        const trigger = createWebTrigger()
        trigger.update(love, 0)
        trigger.update(null, 33)
        expect(trigger.update(love, 66)).toBe(false)
    })

    it('segura a teia durante uma falha curta do reconhecedor', () => {
        const trigger = createWebTrigger()
        trigger.update(love, 0)
        trigger.update(love, 33)
        expect(trigger.update(null, 100)).toBe(true)
        expect(trigger.update({ name: 'None', score: 0.9 }, 200)).toBe(true)
    })

    it('solta depois de 250 ms sem o gesto', () => {
        const trigger = createWebTrigger()
        trigger.update(love, 0)
        trigger.update(love, 33)
        expect(trigger.update(null, 280)).toBe(true)
        expect(trigger.update(null, 284)).toBe(false)
    })

    it('volta a lançar depois de soltar', () => {
        const trigger = createWebTrigger()
        trigger.update(love, 0)
        trigger.update(love, 33)
        trigger.update(null, 400)
        trigger.update(love, 433)
        expect(trigger.update(love, 466)).toBe(true)
    })

    it('reset solta a teia', () => {
        const trigger = createWebTrigger()
        trigger.update(love, 0)
        trigger.update(love, 33)
        trigger.reset()
        expect(trigger.update(null, 40)).toBe(false)
    })
})
