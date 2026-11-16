# Clarificação

## Contexto

- **Spec:** [spec.md](spec.md)
- **Status de entrada:** specified
- **Constituição:** 1.0.0
- **Iniciada em:** 2026-11-16

## Log de decisões

### CQ-001 — Escopo

- **Data:** 2026-11-16
- **Impacto:** alto
- **Pergunta:** Limitar a mudança à atualização corretiva do Node 26.13.1?
- **Decisão:** Sim; manter dependências, arquitetura, jogos e mecanismos de segurança.
- **Razão:** Correção específica do runtime já detectada pelo monitor.
- **Alternativas rejeitadas:** atualização ampla ou mudança de major, fora do escopo.
- **Seções atualizadas em spec.md:** objetivos, fora de escopo, FR-001 a FR-004, NFR-001 e NFR-002.

### CQ-002 — Operação e consumo

- **Data:** 2026-11-16
- **Impacto:** alto
- **Pergunta:** Como publicar e validar sem interferir no trabalho do mantenedor?
- **Decisão:** Trabalhar pelo chat com integração GitHub, sem Codex/Work; consultar antes de operações de consumo incerto; deixar PR em draft, sem merge ou deploy.
- **Razão:** Preservar cotas e fluxo de trabalho do mantenedor.
- **Alternativas rejeitadas:** delegar a agente externo, promover a PR automaticamente ou alterar a main.
- **Seções atualizadas em spec.md:** fora de escopo, NFR-002, NFR-003, SC-003.

## Hipóteses remanescentes

A disponibilidade do novo runtime, registry e CI será verificada durante a validação. A exposição em produção não foi demonstrada; implantação fica fora do escopo.

## Gate 1 — Clarificação aprovada

- **Status:** aprovado
- **Aprovador:** wezercarvalho (maintainer)
- **Data:** 2026-11-16
- **Artefatos aprovados:** spec.md, clarification.md, conforme escopo e decisões apresentados na conversa.
- **Referência:** sessão de 16/11/2026: após a apresentação do escopo, o mantenedor respondeu “Pode considerar tudo aprovado”.
- **Observações:** sem merge, deploy, Codex ou Work; PR em draft. Aceite técnico final depende de evidências.

## Emenda CQ-003 — Verificação permanente dos contratos (16/11/2026)

- **Impacto:** médio; ampliação restrita à governança de código.
- **Decisão aprovada:** incorporar `yarn contracts:check` permanentemente ao CI, para resolver a lacuna de validação da issue #132, sem alterar os contratos ou o comportamento dos jogos.
- **Aprovador:** wezercarvalho (maintainer), na conversa de 16/11/2026, ao responder “Pode fazer” à proposta de implementação da melhoria no pipeline seguindo SDD.
- **Limites:** continuar pelo chat, sem Codex/Work, sem merge pelo agente, sem deploy; executar CI existente para validação, após a fase de draft.
- **Seções atualizadas:** objetivos, FR-005, SC-004 e edge cases em spec.md; o Gate 3 permanece condicionado às evidências.
- **Registro:** aprovação da intenção e da implementação da melhoria; não houve revisão linha a linha dos novos artefatos pelo mantenedor.
