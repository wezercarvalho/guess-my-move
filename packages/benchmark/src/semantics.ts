/**
 * Julgamento SEMÂNTICO determinístico mínimo e LOCAL para o benchmark.
 *
 * Importante: o árbitro oficial do jogo vive em `packages/core` (issue do
 * árbitro). Aqui usamos só uma normalização + lista de aliases para separar a
 * VISÃO (o modelo reconheceu a ação?) da SEMÂNTICA (o texto casa com "acenar"?)
 * sem depender de um LLM. Palpites genéricos como "levantar a mão" NÃO contam.
 */

/** Normaliza: minúsculas, sem acentos, sem pontuação, espaços colapsados. */
export function normalize(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

/** Aliases que CONTAM como "acenar" (equivalência de expressão). */
export const WAVING_ALIASES: readonly string[] = [
    'acenar',
    'acenando',
    'aceno',
    'dar tchau',
    'dando tchau',
    'tchau',
    'acenar com a mao',
    'acenando com a mao',
    'waving',
    'wave',
    'waving hand',
    'hand wave',
]

/** Palpites genéricos explicitamente REJEITADOS (não contam como acenar). */
export const REJECTED_GENERIC: readonly string[] = [
    'levantar a mao',
    'mao levantada',
    'mostrar a palma',
    'levantar o braco',
]

const NORMALIZED_ALIASES = WAVING_ALIASES.map(normalize)
const NORMALIZED_REJECTED = REJECTED_GENERIC.map(normalize)

/**
 * Decide, de forma determinística, se um palpite textual casa com "acenar".
 * Primeiro rejeita genéricos conhecidos; depois procura um alias como
 * subexpressão. Retorna também o alias que casou, para auditoria.
 */
export function matchesWaving(guess: string): {
    matched: boolean
    via: string | null
} {
    const n = normalize(guess)
    if (n.length === 0) {
        return { matched: false, via: null }
    }
    for (const rejected of NORMALIZED_REJECTED) {
        if (n === rejected) {
            return { matched: false, via: null }
        }
    }
    for (let i = 0; i < NORMALIZED_ALIASES.length; i++) {
        const alias = NORMALIZED_ALIASES[i]
        const re = new RegExp(`\\b${alias.replace(/\s+/g, '\\s+')}\\b`)
        if (re.test(n)) {
            return { matched: true, via: WAVING_ALIASES[i] }
        }
    }
    return { matched: false, via: null }
}
