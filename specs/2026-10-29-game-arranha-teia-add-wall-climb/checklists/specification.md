# Checklist de especificação — 2026-10-29-game-arranha-teia-add-wall-climb

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
- [x] A spec evita detalhes de implementação não obrigatórios.
- [x] Não há placeholders, linguagem vaga ou requisitos duplicados.

## Requisitos e sucesso

- [x] Requisitos funcionais possuem IDs únicos e obrigação verificável.
- [x] Requisitos não funcionais são mensuráveis ou justificam a forma de evidência.
- [x] Edge cases, hipóteses, dependências e riscos relevantes estão registrados.
- [x] Critérios de sucesso são independentes da solução técnica.
- [x] Fronteira de informação, privacidade e custo foram avaliados.
- [x] Questões críticas para clarificação estão identificadas.

## Resultado

- **Status:** aprovado
- **Pendências/justificativas:** A checklist de especificação está concluída pelo agente revisor e o Gate 1 foi aprovado antecipadamente pelo maintainer em 2026-10-29 (ver `clarification.md`). Pendências de medição declaradas na spec: o sinal de profundidade do MediaPipe ("puxar a mão para trás") é aproximado e não foi medido ao vivo; nada foi testado com a mão real; a sensação de escalada e os valores de jogo (velocidade de escalada, zona morta, tolerância de inatividade) não foram medidos. A implementação é test-first; a validação e o Gate 3 seguem depois do código e dependem do teste ao vivo do maintainer.
