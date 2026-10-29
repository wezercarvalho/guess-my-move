import { describe, expect, it } from 'vitest'

import { createWebTrigger } from '../src/trigger.js'

const love = { name: 'ILoveYou', score: 0.9 }
const fist = { name: 'Closed_Fist', score: 0.9 }
const palm = { name: 'Open_Palm', score: 0.9 }

/** Lança a teia: dois quadros seguidos com a pose. */
function launched() {
    const trigger = createWebTrigger()
    trigger.update(love, 0)
    trigger.update(love, 33)
    return trigger
}

describe('createWebTrigger: lançar', () => {
    it('só lança depois de dois quadros seguidos com a pose de teia', () => {
        const trigger = createWebTrigger()
        expect(trigger.update(love, 0).held).toBe(false)
        expect(trigger.update(love, 33).held).toBe(true)
    })

    it('ignora a pose com pontuação baixa e outros gestos', () => {
        const trigger = createWebTrigger()
        expect(trigger.update({ name: 'ILoveYou', score: 0.6 }, 0).held).toBe(false)
        expect(trigger.update({ name: 'ILoveYou', score: 0.6 }, 33).held).toBe(false)
        expect(trigger.update(palm, 66).held).toBe(false)
        expect(trigger.update(palm, 99).held).toBe(false)
    })

    it('o punho sozinho não lança a teia', () => {
        const trigger = createWebTrigger()
        trigger.update(fist, 0)
        expect(trigger.update(fist, 33).held).toBe(false)
    })

    it('um quadro isolado entre falhas não lança', () => {
        const trigger = createWebTrigger()
        trigger.update(love, 0)
        trigger.update(null, 33)
        expect(trigger.update(love, 66).held).toBe(false)
    })
})

describe('createWebTrigger: segurar e puxar', () => {
    it('a pose e o punho mantêm a teia presa', () => {
        const trigger = launched()
        expect(trigger.update(fist, 100).held).toBe(true)
        expect(trigger.update(love, 200).held).toBe(true)
    })

    it('puxar é o punho com a teia presa; a pose não puxa', () => {
        const trigger = launched()
        expect(trigger.update(love, 100).pull).toBe(false)
        expect(trigger.update(fist, 133)).toEqual({ held: true, pull: true })
        expect(trigger.update(love, 166).pull).toBe(false)
    })

    it('segura a teia durante uma falha curta do reconhecedor', () => {
        const trigger = launched()
        expect(trigger.update(null, 300).held).toBe(true)
        expect(trigger.update({ name: 'None', score: 0.9 }, 500).held).toBe(true)
    })

    it('solta depois de 600 ms sem a pose nem o punho', () => {
        const trigger = launched()
        expect(trigger.update(null, 33 + 600).held).toBe(true)
        expect(trigger.update(null, 33 + 604).held).toBe(false)
    })
})

describe('createWebTrigger: soltar com a palma aberta', () => {
    it('solta com dois quadros seguidos de palma aberta', () => {
        const trigger = launched()
        expect(trigger.update(palm, 100).held).toBe(true)
        expect(trigger.update(palm, 133).held).toBe(false)
    })

    it('um quadro de palma isolado não solta', () => {
        const trigger = launched()
        trigger.update(palm, 100)
        expect(trigger.update(fist, 133).held).toBe(true)
        expect(trigger.update(palm, 166).held).toBe(true)
    })

    it('depois de soltar, volta a lançar com a pose', () => {
        const trigger = launched()
        trigger.update(palm, 100)
        trigger.update(palm, 133)
        trigger.update(love, 166)
        expect(trigger.update(love, 200).held).toBe(true)
    })

    it('reset solta a teia', () => {
        const trigger = launched()
        trigger.reset()
        expect(trigger.update(null, 40)).toEqual({ held: false, pull: false })
    })
})
