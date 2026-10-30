# Checklist de especificação — 2026-10-29-game-arranha-teia-add-head-tracking-camera

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
- **Pendências/justificativas:** A checklist está concluída pelo agente revisor e o Gate 1 foi aprovado antecipadamente pelo maintainer em 2026-10-29 (ver `clarification.md`). Pendências declaradas na spec e em `research.md`: a licença do arquivo `face_landmarker.task` não foi confirmada na fonte (mesma situação dos modelos de mão e de gesto); o fps com mãos e rosto juntos e a precisão da pose da cabeça não foram medidos em GPU real nem com rosto real; o Gate 3 fica pendente do teste ao vivo do maintainer. A implementação é test-first.
