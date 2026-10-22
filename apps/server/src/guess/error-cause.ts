/** Marcador que substitui qualquer trecho sensível removido da causa. */
export const REDACTED = '[redigido]'

/** Tamanho máximo da causa registrada; o excesso é cortado pelo início. */
export const MAX_CAUSE_LENGTH = 400

const UNKNOWN_CAUSE = 'causa desconhecida'

/** Ordem importa: a data URI precisa sair antes do base64 genérico. */
const REDACTIONS: readonly RegExp[] = [
    /data:[\w/+.-]+;base64,[A-Za-z0-9+/=]*/g,
    /Bearer\s+[A-Za-z0-9._~+/=-]+/gi,
    /\bsk-[A-Za-z0-9_-]{8,}/g,
    /[A-Za-z0-9+/=_-]{40,}/g,
]

/**
 * Descreve a causa de uma falha do provedor para o log técnico. Função pura:
 * remove mídia (base64 e data URIs) e credenciais, colapsa o espaço em branco
 * e limita o tamanho preservando o FINAL do texto, onde um CLI como o `codex`
 * informa o motivo real depois de ecoar o prompt.
 */
export function describeCause(cause: unknown): string {
    const raw = rawDescription(cause)
    let text = raw
    for (const pattern of REDACTIONS) {
        text = text.replace(pattern, REDACTED)
    }
    text = text.replace(/\s+/g, ' ').trim()
    if (text.length > MAX_CAUSE_LENGTH) {
        text = `…${text.slice(-(MAX_CAUSE_LENGTH - 1))}`
    }
    return text === '' ? UNKNOWN_CAUSE : text
}

function rawDescription(cause: unknown): string {
    if (cause instanceof Error) {
        return `${cause.name}: ${cause.message}`
    }
    if (typeof cause === 'string') {
        return cause
    }
    return UNKNOWN_CAUSE
}
