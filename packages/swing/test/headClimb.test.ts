import { describe, expect, it } from 'vitest'

import { DEFAULT_HEAD_CLIMB, createHeadClimb } from '../src/headClimb.js'

const deg = (value: number) => (value * Math.PI) / 180
const DT = 16

/** Roda `ms` milissegundos de quadros com a mesma entrada e devolve o último resultado. */
function hold(
    climb: ReturnType<typeof createHeadClimb>,
    input: { pitch: number; yaw: number; active: boolean },
    ms: number,
) {
    let result = climb.update(input, 0)
    for (let elapsed = 0; elapsed < ms; elapsed += DT) result = climb.update(input, DT)
    return result
}

const lookUp = { pitch: deg(20), yaw: 0, active: true }
const lookDown = { pitch: deg(-20), yaw: 0, active: true }
const neutral = { pitch: 0, yaw: 0, active: true }
const lookSide = { pitch: deg(20), yaw: deg(40), active: true }

describe('createHeadClimb (escalar olhando)', () => {
    it('olhar para cima ainda não sobe: precisa segurar o olhar pelo tempo de espera', () => {
        const climb = createHeadClimb()
        const early = hold(climb, lookUp, DEFAULT_HEAD_CLIMB.dwellMs - 400)
        expect(early.climb).toBe(0)
        expect(early.intent).toBe('up')
        expect(early.climbing).toBe(false)
        expect(early.progress).toBeGreaterThan(0.5)
        expect(early.progress).toBeLessThan(1)
    })

    it('depois de ~2 s olhando para cima, começa a subir e continua enquanto segura', () => {
        const climb = createHeadClimb()
        const result = hold(climb, lookUp, DEFAULT_HEAD_CLIMB.dwellMs + 200)
        expect(result.climbing).toBe(true)
        expect(result.climb).toBeGreaterThan(0)
        expect(hold(climb, lookUp, 3000).climb).toBeGreaterThan(0)
    })

    it('depois de ~2 s olhando para baixo, começa a descer', () => {
        const climb = createHeadClimb()
        const result = hold(climb, lookDown, DEFAULT_HEAD_CLIMB.dwellMs + 200)
        expect(result.climbing).toBe(true)
        expect(result.climb).toBeLessThan(0)
        expect(result.intent).toBe('down')
    })

    it('olhar para o lado para de subir na hora', () => {
        const climb = createHeadClimb()
        hold(climb, lookUp, DEFAULT_HEAD_CLIMB.dwellMs + 200)
        const result = hold(climb, lookSide, DT * 2)
        expect(result.climb).toBe(0)
        expect(result.climbing).toBe(false)
        expect(result.intent).toBeNull()
    })

    it('voltar o olhar ao centro para de subir', () => {
        const climb = createHeadClimb()
        hold(climb, lookUp, DEFAULT_HEAD_CLIMB.dwellMs + 200)
        const result = hold(climb, neutral, DT * 2)
        expect(result.climb).toBe(0)
        expect(result.climbing).toBe(false)
    })

    it('para voltar a subir depois de parar, repete o processo: de novo o tempo de espera', () => {
        const climb = createHeadClimb()
        hold(climb, lookUp, DEFAULT_HEAD_CLIMB.dwellMs + 200)
        hold(climb, lookSide, 500)
        const again = hold(climb, lookUp, 600)
        expect(again.climbing).toBe(false)
        expect(again.climb).toBe(0)
        expect(hold(climb, lookUp, DEFAULT_HEAD_CLIMB.dwellMs).climbing).toBe(true)
    })

    it('trocar de cima para baixo recomeça a espera (não inverte na hora)', () => {
        const climb = createHeadClimb()
        hold(climb, lookUp, DEFAULT_HEAD_CLIMB.dwellMs + 200)
        const result = hold(climb, lookDown, 500)
        expect(result.climb).toBe(0)
        expect(result.intent).toBe('down')
        expect(result.climbing).toBe(false)
    })

    it('uma oscilação pequena abaixo do limite de manter não interrompe a espera, mas abaixo do limite de manter zera', () => {
        const climb = createHeadClimb()
        hold(climb, lookUp, 1000)
        // Ainda acima do limite de manter (histerese): segue contando.
        const kept = hold(climb, { pitch: DEFAULT_HEAD_CLIMB.pitchHold + deg(1), yaw: 0, active: true }, 600)
        expect(kept.progress).toBeGreaterThan(0.7)
        // Abaixo do limite de manter: recomeça.
        const dropped = hold(climb, { pitch: DEFAULT_HEAD_CLIMB.pitchHold - deg(2), yaw: 0, active: true }, DT * 2)
        expect(dropped.intent).toBeNull()
        expect(dropped.progress).toBe(0)
    })

    it('já subindo, tolera uma inclinação menor (histerese) sem parar', () => {
        const climb = createHeadClimb()
        hold(climb, lookUp, DEFAULT_HEAD_CLIMB.dwellMs + 200)
        const softer = hold(climb, { pitch: DEFAULT_HEAD_CLIMB.pitchHold + deg(1), yaw: 0, active: true }, 800)
        expect(softer.climbing).toBe(true)
    })

    it('inativo (sem agarre, sem rosto ou modo automático) zera tudo', () => {
        const climb = createHeadClimb()
        hold(climb, lookUp, DEFAULT_HEAD_CLIMB.dwellMs + 200)
        const result = hold(climb, { ...lookUp, active: false }, DT * 2)
        expect(result).toEqual({ climb: 0, intent: null, progress: 0, climbing: false })
        // Ao reativar, começa do zero.
        expect(hold(climb, lookUp, 500).climbing).toBe(false)
    })

    it('uma inclinação abaixo do limite de começar nunca sobe, por mais que dure', () => {
        const climb = createHeadClimb()
        const mild = { pitch: DEFAULT_HEAD_CLIMB.pitchStart - deg(2), yaw: 0, active: true }
        const result = hold(climb, mild, 10000)
        expect(result.climbing).toBe(false)
        expect(result.climb).toBe(0)
    })

    it('reset() volta ao estado inicial', () => {
        const climb = createHeadClimb()
        hold(climb, lookUp, DEFAULT_HEAD_CLIMB.dwellMs + 200)
        climb.reset()
        expect(climb.update(neutral, 0)).toEqual({ climb: 0, intent: null, progress: 0, climbing: false })
    })

    it('o tempo de espera padrão é de cerca de 2 s', () => {
        expect(DEFAULT_HEAD_CLIMB.dwellMs).toBe(2000)
    })
})
