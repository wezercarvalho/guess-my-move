// As dez categorias de desfecho em que o auditor não emite veredito. O rótulo de
// cada uma é estável: aparece no início da mensagem e é o que o CI e a
// documentação citam. As categorias `sem-dados` e `erros-do-yarn` do Yarn 1 saíram:
// o `yarn npm audit` do Yarn 4 trata saída vazia como relatório limpo e não emite
// registros de erro no NDJSON.
export const AUDIT_FAILURE_CATEGORIES = [
    'saida-invalida',
    'formato-inesperado',
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
