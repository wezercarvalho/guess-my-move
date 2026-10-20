# Checklist de especificação — <ID e título>

- **Spec:** `../spec.md`
- **Revisor:** <pessoa ou função>
- **Data:** `AAAA-MM-DD`

## Metadata e descoberta

- [ ] Nome segue `YYYY-MM-DD-<domínio>-<capacidade>-<objetivo>`.
- [ ] ID, slug, domínio, capacidade e objetivo convergem com o diretório.
- [ ] O prefixo de data é válido no calendário e igual a `created_at`.
- [ ] Título, aliases, resumo e status constam no frontmatter de `spec.md`.
- [ ] Owners, versão constitucional e datas estão definidos.
- [ ] Specs relacionadas, substituições, branch e caminhos de código foram considerados.

## Qualidade da intenção

- [ ] Problema, objetivos e fora de escopo são explícitos.
- [ ] Atores e histórias P1 são identificáveis.
- [ ] Cada história possui teste independente e critérios observáveis.
- [ ] A spec evita detalhes de implementação não obrigatórios.
- [ ] Não há placeholders, linguagem vaga ou requisitos duplicados.

## Requisitos e sucesso

- [ ] Requisitos funcionais possuem IDs únicos e obrigação verificável.
- [ ] Requisitos não funcionais são mensuráveis ou justificam a forma de evidência.
- [ ] Edge cases, hipóteses, dependências e riscos relevantes estão registrados.
- [ ] Critérios de sucesso são independentes da solução técnica.
- [ ] Fronteira de informação (carta x adivinhador), privacidade e custo foram avaliados.
- [ ] Questões críticas para clarificação estão identificadas.

## Resultado

- **Status:** pendente | aprovado | rejeitado
- **Pendências/justificativas:** <nenhuma ou lista objetiva>
