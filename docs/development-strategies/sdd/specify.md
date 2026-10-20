# Fase: Especificação

## Propósito

Transformar uma intenção em um contrato comportamental completo, pesquisável e testável, sem antecipar decisões de implementação.

## Entradas

- pedido e objetivos das pessoas interessadas;
- [`constitution.md`](constitution.md) vigente;
- [catálogo de specs](../../../specs/README.md) e specs relacionadas;
- [`docs/product/PROJECT_SPEC.md`](../../product/PROJECT_SPEC.md) e contexto aplicável.

## Saídas

- diretório `specs/YYYY-MM-DD-<domínio>-<capacidade>-<objetivo>/`;
- `spec.md` baseado em [`templates/spec.md`](templates/spec.md);
- `checklists/specification.md` baseado em [`templates/specification-checklist.md`](templates/specification-checklist.md).

## Procedimento

1. Confirme que SDD é a estratégia adequada pelo [roteador](../README.md).
2. Consulte a constituição e registre sua versão no frontmatter.
3. Pesquise `specs/*/spec.md` por termos, aliases e domínio para evitar duplicação.
4. Defina a data real de criação e o slug; `id` é a data + slug, igual ao nome do diretório e a `created_at`.
5. Defina problema, objetivos, fora de escopo, atores e dependências.
6. Escreva histórias priorizadas que possam ser demonstradas de modo independente.
7. Expresse critérios em termos observáveis, preferencialmente Dado/Quando/Então.
8. Numere requisitos funcionais (`FR-001`), não funcionais (`NFR-001`) e critérios de sucesso (`SC-001`). IDs não mudam depois de referenciados.
9. Registre edge cases, hipóteses e riscos sem escolher prematuramente ferramentas.
10. Execute a checklist e corrija a spec até os itens obrigatórios estarem atendidos ou justificados.
11. Atualize o status para `specified`.

## Regras de qualidade

- Explique **o quê** e **por quê**; deixe o **como** para pesquisa e plano.
- Evite "adequado", "rápido", "seguro" ou "intuitivo" sem medida.
- Cada história P1 deve ser um incremento útil e demonstrável.
- Decisões desconhecidas relevantes viram questão de clarificação; sem placeholders silenciosos.
- `spec.md` deve ser compreensível sem ler código ou conversa de chat.

## Gate de saída

Termina em `specified` quando metadata e diretório convergem, a checklist está concluída, não há placeholders ou requisitos duplicados e os itens críticos de clarificação estão identificados. A aprovação humana ocorre após a Clarificação.
