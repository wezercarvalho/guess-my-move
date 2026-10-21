/**
 * Normalização de texto do árbitro: determinística e conservadora. Reduz o
 * palpite a uma forma canônica para comparação por equivalência de expressão
 * (nunca por substring): minúsculas, remoção de acentos, pontuação virando
 * espaço e espaços colapsados.
 */

/**
 * Normaliza um texto para comparação.
 *
 * - minúsculas;
 * - remove acentos (decomposição Unicode + descarte de diacríticos);
 * - troca qualquer caractere que não seja letra/dígito por espaço;
 * - colapsa espaços e apara as pontas.
 *
 * Um texto vazio, só com pontuação ou só com espaços vira string vazia.
 */
export function normalize(text: string): string {
    return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .replace(/\s+/g, ' ')
}
