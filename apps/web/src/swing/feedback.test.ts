import { describe, expect, it } from 'vitest'

import { type FeedbackInput, deriveChips, feedbackEvents } from './feedback.js'

/** Estado base: jogando, sem câmera, nada acontecendo. */
const base: FeedbackInput = {
    phase: 'playing',
    cameraActive: false,
    lookMode: 'face',
    faceTrackerStatus: 'idle',
    faceVisible: false,
    lockMode: 'following',
    gripped: false,
    headClimb: { intent: null, progress: 0, climbing: false },
    cue: 'swing',
    webSides: [],
}

/** Câmera ativa no modo Rosto com o rosto à vista. */
const withFace: FeedbackInput = { ...base, cameraActive: true, faceTrackerStatus: 'ready', faceVisible: true }

const ids = (input: FeedbackInput) => deriveChips(input).map((chip) => chip.id)

describe('deriveChips', () => {
    it('é vazia sem nada a dizer', () => {
        expect(deriveChips(base)).toEqual([])
        expect(deriveChips(withFace)).toEqual([])
    })

    it('é vazia fora do jogo (carregando ou erro)', () => {
        expect(deriveChips({ ...withFace, phase: 'loading', lockMode: 'locked', gripped: true })).toEqual([])
        expect(deriveChips({ ...withFace, phase: 'error', lockMode: 'locked' })).toEqual([])
    })

    it('direção travada: mostra o estado enquanto o gesto vale', () => {
        const chips = deriveChips({ ...withFace, lockMode: 'locked' })
        expect(chips).toEqual([{ id: 'lock', text: 'Direção travada', tone: 'active' }])
    })

    it('agarrado sem rosto: mostra o agarre e como subir com as mãos', () => {
        const chips = deriveChips({ ...base, gripped: true, cue: 'grip' })
        expect(chips).toHaveLength(1)
        expect(chips[0]).toMatchObject({ id: 'grip', tone: 'active' })
        expect(chips[0]?.text).toMatch(/agarrado/i)
        expect(chips[0]?.text).toMatch(/uma mão por vez/i)
        expect(chips[0]?.progress).toBeUndefined()
    })

    it('agarrado com rosto à vista: ensina o olhar de escalada', () => {
        const chip = deriveChips({ ...withFace, gripped: true, cue: 'grip' })[0]
        expect(chip?.text).toMatch(/olhe 2 s para cima ou para baixo/i)
    })

    it('esperando para escalar: mostra a direção, os segundos que faltam e a barra', () => {
        const chip = deriveChips({
            ...withFace,
            gripped: true,
            cue: 'grip',
            headClimb: { intent: 'up', progress: 0.4, climbing: false },
        })[0]
        expect(chip?.text).toBe('Olhando para cima… 1,2 s')
        expect(chip?.progress).toBeCloseTo(0.4, 5)
        expect(chip?.tone).toBe('active')
    })

    it('esperando para descer: diz baixo', () => {
        const chip = deriveChips({
            ...withFace,
            gripped: true,
            cue: 'grip',
            headClimb: { intent: 'down', progress: 0.9, climbing: false },
        })[0]
        expect(chip?.text).toBe('Olhando para baixo… 0,2 s')
    })

    it('escalando: diz subindo ou descendo e como parar, sem barra', () => {
        const up = deriveChips({
            ...withFace,
            gripped: true,
            cue: 'grip',
            headClimb: { intent: 'up', progress: 1, climbing: true },
        })[0]
        expect(up?.text).toMatch(/subindo/i)
        expect(up?.text).toMatch(/olhe para o lado para parar/i)
        expect(up?.progress).toBeUndefined()
        const down = deriveChips({
            ...withFace,
            gripped: true,
            cue: 'grip',
            headClimb: { intent: 'down', progress: 1, climbing: true },
        })[0]
        expect(down?.text).toMatch(/descendo/i)
    })

    it('em Automática o olhar de escalada não aparece, mesmo com intenção registrada', () => {
        const chip = deriveChips({
            ...withFace,
            lookMode: 'auto',
            gripped: true,
            cue: 'grip',
            headClimb: { intent: 'up', progress: 0.4, climbing: false },
        })[0]
        expect(chip?.text).toMatch(/uma mão por vez/i)
    })

    it('sem rosto à vista o olhar de escalada não aparece', () => {
        const chip = deriveChips({
            ...withFace,
            faceVisible: false,
            gripped: true,
            cue: 'grip',
            headClimb: { intent: 'up', progress: 0.4, climbing: false },
        }).find((item) => item.id === 'grip')
        expect(chip?.text).toMatch(/uma mão por vez/i)
    })

    it('encostado na parede sem agarrar: dica de agarrar', () => {
        const chips = deriveChips({ ...base, cue: 'wall' })
        expect(chips).toEqual([{ id: 'wall', text: 'Parede: abra a mão para agarrar.', tone: 'info' }])
    })

    it('agarrado, a dica de parede some', () => {
        expect(ids({ ...base, cue: 'wall', gripped: true })).toEqual(['grip'])
    })

    it('rosto fora do quadro no modo Rosto: avisa', () => {
        const chips = deriveChips({ ...withFace, faceVisible: false })
        expect(chips).toEqual([{ id: 'face', text: 'Rosto fora do quadro', tone: 'warn' }])
    })

    it('não avisa de rosto sem câmera, em Automática, carregando ou travada', () => {
        expect(ids({ ...withFace, cameraActive: false, faceVisible: false })).toEqual([])
        expect(ids({ ...withFace, lookMode: 'auto', faceVisible: false })).toEqual([])
        expect(ids({ ...withFace, faceTrackerStatus: 'loading', faceVisible: false })).toEqual([])
        expect(ids({ ...withFace, faceTrackerStatus: 'error', faceVisible: false })).toEqual([])
        expect(ids({ ...withFace, faceVisible: false, lockMode: 'locked' })).toEqual(['lock'])
    })

    it('vários estados juntos: agarre ou parede primeiro, depois a trava, depois o rosto', () => {
        expect(ids({ ...withFace, gripped: true, cue: 'grip', lockMode: 'locked' })).toEqual(['grip', 'lock'])
        expect(ids({ ...withFace, cue: 'wall', faceVisible: false })).toEqual(['wall', 'face'])
    })
})

describe('feedbackEvents', () => {
    it('sem estado anterior não há aviso', () => {
        expect(feedbackEvents(null, { ...withFace, lockMode: 'locked' })).toEqual([])
    })

    it('nada muda, nada avisa', () => {
        expect(feedbackEvents(withFace, withFace)).toEqual([])
    })

    it('direção liberada ao soltar o gesto; travar não gera aviso (o chip já mostra)', () => {
        expect(feedbackEvents({ ...withFace, lockMode: 'locked' }, withFace)).toEqual(['Direção liberada'])
        expect(feedbackEvents(withFace, { ...withFace, lockMode: 'locked' })).toEqual([])
    })

    it('soltou da parede ao deixar o agarre; agarrar não gera aviso', () => {
        expect(feedbackEvents({ ...base, gripped: true }, base)).toEqual(['Soltou da parede'])
        expect(feedbackEvents(base, { ...base, gripped: true })).toEqual([])
    })

    it('teia presa diz qual mão', () => {
        expect(feedbackEvents(base, { ...base, webSides: [-1] })).toEqual(['Teia presa: esquerda'])
        expect(feedbackEvents(base, { ...base, webSides: [1] })).toEqual(['Teia presa: direita'])
        expect(feedbackEvents(base, { ...base, webSides: [0] })).toEqual(['Teia presa: centro'])
    })

    it('as duas mãos de uma vez: "as duas"; a segunda depois da primeira diz só a nova', () => {
        expect(feedbackEvents(base, { ...base, webSides: [-1, 1] })).toEqual(['Teia presa: as duas'])
        expect(feedbackEvents({ ...base, webSides: [-1] }, { ...base, webSides: [-1, 1] })).toEqual([
            'Teia presa: direita',
        ])
    })

    it('teia solta ao perder qualquer teia', () => {
        expect(feedbackEvents({ ...base, webSides: [-1, 1] }, { ...base, webSides: [1] })).toEqual(['Teia solta'])
        expect(feedbackEvents({ ...base, webSides: [-1] }, base)).toEqual(['Teia solta'])
    })

    it('troca de mão no mesmo quadro: solta e prende', () => {
        expect(feedbackEvents({ ...base, webSides: [-1] }, { ...base, webSides: [1] })).toEqual([
            'Teia solta',
            'Teia presa: direita',
        ])
    })

    it('rosto detectado depois de sair do quadro, só no modo Rosto com a câmera ativa', () => {
        expect(feedbackEvents({ ...withFace, faceVisible: false }, withFace)).toEqual(['Rosto detectado'])
        expect(feedbackEvents({ ...withFace, faceVisible: false, cameraActive: false }, { ...withFace, cameraActive: false })).toEqual([])
        expect(feedbackEvents({ ...withFace, lookMode: 'auto', faceVisible: false }, { ...withFace, lookMode: 'auto' })).toEqual([])
    })

    it('não avisa fora do jogo, em nenhum dos dois estados', () => {
        expect(feedbackEvents({ ...base, phase: 'loading', gripped: true }, base)).toEqual([])
        expect(feedbackEvents({ ...base, gripped: true }, { ...base, phase: 'error' })).toEqual([])
    })

    it('vários eventos juntos saem na ordem: trava, parede, teia, rosto', () => {
        const prev: FeedbackInput = { ...withFace, lockMode: 'locked', gripped: true, webSides: [-1], faceVisible: false }
        const next: FeedbackInput = { ...withFace, lockMode: 'following', gripped: false, webSides: [] }
        expect(feedbackEvents(prev, next)).toEqual([
            'Direção liberada',
            'Soltou da parede',
            'Teia solta',
            'Rosto detectado',
        ])
    })
})
