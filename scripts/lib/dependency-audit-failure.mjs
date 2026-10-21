// As doze categorias de desfecho em que o auditor não emite veredito. O rótulo de
// cada uma é estável: aparece no início da mensagem e é o que o CI e a
// documentação citam.
export const AUDIT_FAILURE_CATEGORIES = [
    'saida-invalida',
    'formato-inesperado',
    'sem-dados',
    'erros-do-yarn',
    'yarn-falhou',
    'yarn-sinal',
    'yarn-nao-iniciou',
    'limite-de-saida',
    'timeout',
    'registry-indisponivel',
    'excecoes-invalidas',
    'erro-interno',
]

// Falha em que o auditor não consegue emitir veredito; a categoria vem no início
// da mensagem para distinguir a causa no log do CI.
export class AuditFailure extends Error {
    constructor(category, detail) {
        super(`[${category}] ${detail}`)
        this.name = 'AuditFailure'
        this.category = category
    }
}
