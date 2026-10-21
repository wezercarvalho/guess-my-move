import type { GuesserResult } from '@guess-my-move/core'

/**
 * Erro lançado quando a saída de um provedor não respeita o contrato
 * `GuesserResult`. Mantém a causa interna fora da mensagem exposta pela API: o
 * servidor converte este erro em `invalid_model_response` sem detalhes.
 */
export class InvalidProviderOutputError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'InvalidProviderOutputError'
    }
}

/**
 * JSON Schema do objeto devolvido pelo provedor. Também usado pelo `codex`.
 *
 * Observação empírica (verificação do Codex, 2026-10-21): a saída estruturada
 * da OpenAI exige que TODA propriedade de `properties` esteja em `required` e
 * `additionalProperties: false`. Por isso ambos os campos são obrigatórios aqui
 * — o modelo ainda pode devolver `insufficientEvidence: false`. O parser em
 * `parseGuesserResult` mantém `insufficientEvidence` opcional no tipo TS.
 */
export const guesserResultJsonSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
        guess: { type: 'string' },
        insufficientEvidence: { type: 'boolean' },
    },
    required: ['guess', 'insufficientEvidence'],
} as const

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Valida uma saída desconhecida (por exemplo, JSON vindo de um processo
 * externo) contra o contrato `GuesserResult` e devolve um resultado tipado e
 * normalizado. Rejeita respostas vazias, fora de formato ou com campos extras.
 */
export function parseGuesserResult(value: unknown): GuesserResult {
    if (!isRecord(value)) {
        throw new InvalidProviderOutputError(
            'saída do provedor não é um objeto',
        )
    }
    const { guess, insufficientEvidence } = value
    if (typeof guess !== 'string' || guess.trim().length === 0) {
        throw new InvalidProviderOutputError(
            'campo "guess" ausente ou vazio na saída do provedor',
        )
    }
    if (
        insufficientEvidence !== undefined &&
        typeof insufficientEvidence !== 'boolean'
    ) {
        throw new InvalidProviderOutputError(
            'campo "insufficientEvidence" deve ser booleano',
        )
    }
    const extraKeys = Object.keys(value).filter(
        (key) => key !== 'guess' && key !== 'insufficientEvidence',
    )
    if (extraKeys.length > 0) {
        throw new InvalidProviderOutputError(
            `saída do provedor contém campos inesperados: ${extraKeys.join(', ')}`,
        )
    }
    const result: GuesserResult = { guess: guess.trim() }
    if (insufficientEvidence !== undefined) {
        result.insufficientEvidence = insufficientEvidence
    }
    return result
}
