/**
 * Histórico de palpites rejeitados do PRÓPRIO modelo, só em memória. Guarda
 * apenas os palpites que o adivinhador já fez e que foram recusados, nunca
 * qualquer dado da carta (palavra, dica, sugestão, canônico, aliases,
 * critérios). Deduplicado por forma normalizada; descartado ao fim da rodada.
 *
 * O objetivo é enviar esses palpites como `rejectedGuesses` na próxima
 * tentativa, para o modelo explorar outras hipóteses sem repetir o que já
 * recusou.
 */

/** Normaliza um palpite para deduplicação (caixa, acentos e espaços). */
function dedupKey(guess: string): string {
    return guess
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .replace(/\s+/g, ' ')
}

/** Coleção em memória dos palpites rejeitados do modelo. */
export class RejectedGuesses {
    private readonly order: string[] = []
    private readonly seen = new Set<string>()

    /** Quantidade de palpites únicos registrados. */
    get size(): number {
        return this.order.length
    }

    /**
     * Adiciona um palpite do modelo. Ignora vazios/sem conteúdo e duplicados
     * (por forma normalizada). Preserva o texto original na ordem de inserção.
     */
    add(guess: string): void {
        const key = dedupKey(guess)
        if (key === '' || this.seen.has(key)) return
        this.seen.add(key)
        this.order.push(guess)
    }

    /** Verdadeiro quando um palpite equivalente já foi registrado. */
    has(guess: string): boolean {
        return this.seen.has(dedupKey(guess))
    }

    /** Cópia dos palpites registrados, em ordem de inserção. */
    toArray(): string[] {
        return [...this.order]
    }

    /** Descarta todo o histórico (sem persistência). */
    clear(): void {
        this.order.length = 0
        this.seen.clear()
    }
}
