/**
 * Tipos do árbitro semântico. O veredito registra sempre o método e um motivo
 * resumido para auditoria e ajuste de aliases.
 */

/**
 * Como o veredito foi decidido:
 * - `canonical`: equivalente à resposta canônica;
 * - `alias`: equivalente a um alias aceito;
 * - `llm`: decidido pelo fallback opcional por LLM (ver #14);
 * - `insufficient`: palpite reconhecidamente genérico/insuficiente;
 * - `none`: não corresponde a nada conhecido (incorreto, mas não insuficiente);
 * - `undetermined`: dúvida material — nunca é tratado como acerto.
 */
export type RefereeMethod =
    | 'canonical'
    | 'alias'
    | 'llm'
    | 'insufficient'
    | 'none'
    | 'undetermined'

/** Resultado do julgamento de um palpite. */
export interface RefereeResult {
    isCorrect: boolean
    method: RefereeMethod
    matchedAnswer?: string
    reason?: string
}
