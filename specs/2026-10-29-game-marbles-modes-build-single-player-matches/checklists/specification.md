# Checklist de especificação — 2026-10-29-game-marbles-modes-build-single-player-matches

- **Spec:** `../spec.md`
- **Revisor:** kirocrew (agente)
- **Data:** `2026-10-29`

## Metadata e descoberta

- [x] Nome segue `YYYY-MM-DD-<domínio>-<capacidade>-<objetivo>`.
- [x] ID, slug, domínio, capacidade e objetivo convergem com o diretório.
- [x] O prefixo de data é válido no calendário e igual a `created_at`.
- [x] Título, aliases, resumo e status constam no frontmatter de `spec.md`.
- [x] Owners, versão constitucional e datas estão definidos.
- [x] Specs relacionadas, substituições, branch e caminhos de código foram considerados.

## Qualidade da intenção

- [x] Problema, objetivos e fora de escopo são explícitos.
- [x] Atores e histórias P1 são identificáveis.
- [x] Cada história possui teste independente e critérios observáveis.
- [x] A spec evita detalhes de implementação não obrigatórios (os números das issues são restrições do produto, não decisões técnicas).
- [x] Não há placeholders, linguagem vaga ou requisitos duplicados.

## Requisitos e sucesso

- [x] Requisitos funcionais possuem IDs únicos e obrigação verificável.
- [x] Requisitos não funcionais são mensuráveis ou justificam a forma de evidência.
- [x] Edge cases, hipóteses, dependências e riscos relevantes estão registrados.
- [x] Critérios de sucesso são independentes da solução técnica.
- [x] Fronteira de informação (carta x adivinhador), privacidade e custo foram avaliados (sem carta neste jogo; privacidade preservada; sem custo de provedor).
- [x] Questões críticas para clarificação estão identificadas.

## Resultado

- **Status:** aprovado
- **Pendências/justificativas:** A checklist de especificação está concluída pelo agente revisor e o Gate 1 foi aprovado antecipadamente pelo maintainer em 2026-10-29 (ver `../clarification.md`). Pendências declaradas na spec: os valores de jogo (3 rodadas, 5/8/9 tiros, metas de vitória, velocidade de entrada da cova, nível do bot) são palpites iniciais a calibrar com uso real; a faixa de acerto do bot é proteção de regressão e não medida de equilíbrio; não há teste ao vivo com a mão real nesta entrega. A implementação é test-first e a validação com o Gate 3 seguem depois do código.
