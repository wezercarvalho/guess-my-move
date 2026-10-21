import { describe, expect, it } from 'vitest'

import {
    InvalidProviderOutputError,
    parseGuesserResult,
} from '../src/result-schema.js'

describe('parseGuesserResult', () => {
    it('aceita um palpite simples', () => {
        expect(parseGuesserResult({ guess: 'acenar' })).toEqual({
            guess: 'acenar',
        })
    })

    it('normaliza espaços e preserva insufficientEvidence', () => {
        expect(
            parseGuesserResult({
                guess: '  acenar  ',
                insufficientEvidence: true,
            }),
        ).toEqual({ guess: 'acenar', insufficientEvidence: true })
    })

    it('rejeita objeto sem guess', () => {
        expect(() => parseGuesserResult({})).toThrow(
            InvalidProviderOutputError,
        )
    })

    it('rejeita guess vazio', () => {
        expect(() => parseGuesserResult({ guess: '   ' })).toThrow(
            InvalidProviderOutputError,
        )
    })

    it('rejeita insufficientEvidence não booleano', () => {
        expect(() =>
            parseGuesserResult({ guess: 'x', insufficientEvidence: 'sim' }),
        ).toThrow(InvalidProviderOutputError)
    })

    it('rejeita campos inesperados', () => {
        expect(() =>
            parseGuesserResult({ guess: 'x', hint: 'vazou a dica' }),
        ).toThrow(InvalidProviderOutputError)
    })

    it('rejeita valores que não são objeto', () => {
        expect(() => parseGuesserResult('acenar')).toThrow(
            InvalidProviderOutputError,
        )
        expect(() => parseGuesserResult(null)).toThrow(
            InvalidProviderOutputError,
        )
    })
})
