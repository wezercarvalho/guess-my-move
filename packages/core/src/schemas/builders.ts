/**
 * Blocos de construção dos schemas do núcleo (Zod Mini). Centraliza as mensagens
 * em português e a política de objetos estritos: campo extra é erro, o que
 * reforça a fronteira de informação (nenhum dado inesperado atravessa um
 * contrato). O Zod Mini é a API funcional e tree-shakable do Zod, escolhida para
 * não pesar no bundle do navegador; o schema continua sendo Standard Schema.
 */
import * as z from 'zod/mini'

/** Nomes legíveis dos tipos que o Zod reporta em inglês. */
const TYPE_NAMES: Record<string, string> = {
    string: 'um texto',
    number: 'um número',
    boolean: 'verdadeiro ou falso',
    object: 'um objeto',
    array: 'uma lista',
}

/** Mensagens de erro em português para os schemas do projeto. */
export function ptBR(issue: z.core.$ZodRawIssue): string | undefined {
    switch (issue.code) {
        case 'invalid_type':
            return issue.input === undefined
                ? 'campo obrigatório'
                : `deve ser ${TYPE_NAMES[String(issue.expected)] ?? String(issue.expected)}`
        case 'unrecognized_keys':
            return `campos não permitidos: ${issue.keys.join(', ')}`
        case 'invalid_value':
            return 'valor não permitido'
        case 'too_small':
            return 'valor pequeno demais'
        case 'too_big':
            return 'valor grande demais'
        case 'invalid_format':
            return 'formato inválido'
        default:
            return undefined
    }
}

/** Texto (string) com mensagem em português. */
export const text = () => z.string({ error: ptBR })

/** Texto que não pode ser vazio nem só espaços. */
export const nonEmptyText = () =>
    text().check(
        z.refine((value) => value.trim().length > 0, {
            error: 'não pode ser vazio',
        }),
    )

/** Lista de textos. */
export const textList = () => z.array(text(), { error: ptBR })

/** Objeto estrito: rejeita qualquer campo não declarado. */
export const strict = <T extends z.core.$ZodShape>(shape: T) =>
    z.strictObject(shape, { error: ptBR })
