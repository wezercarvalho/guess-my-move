# Clarificação — 2026-10-21-engineering-toolchain-adopt-yarn4-oxlint-node26

## Contexto

- **Spec:** `spec.md`
- **Status de entrada:** `specified`
- **Constituição:** `1.0.0`
- **Iniciada em:** `2026-10-21`

As decisões abaixo foram **definidas em 2026-10-21 pelo mantenedor e são revisáveis**, com base nos critérios das issues #43 (Yarn 4.18.1), #45 (Oxlint + tsgolint + TypeScript 7) e #46 (Node 26).

## Log de decisões

### CQ-001 — Linker do Yarn 4

- **Data:** `2026-10-21`
- **Impacto:** alto
- **Pergunta:** Qual estratégia de linker o Yarn 4 deve usar?
- **Decisão:** `nodeLinker: node-modules` no `.yarnrc.yml`.
- **Razão:** Compatibilidade sem atrito com Nest, Vite e as ferramentas de lint do monorepo.
- **Alternativas rejeitadas:** Plug'n'Play (PnP) — atrito conhecido com Nest/Vite/lint.
- **Seções atualizadas em `spec.md`:** FR-001, US-001.

### CQ-002 — Política de auditoria em duas execuções

- **Data:** `2026-10-21`
- **Impacto:** alto
- **Pergunta:** Como preservar a política de auditoria sobre Yarn 4?
- **Decisão:** `yarn npm audit` em duas execuções, `--environment production` e `--environment development`, mantendo High/Critical bloqueando e exceções com validade; falha de registry só avisa no hook.
- **Razão:** Yarn 4 não tem a flag `dev` do Yarn 1; separar por ambiente preserva a mesma política.
- **Alternativas rejeitadas:** Flag `dev` do Yarn 1 — inexistente no Yarn 4.
- **Seções atualizadas em `spec.md`:** FR-003, US-002.

### CQ-003 — Peers de vitest nos workspaces

- **Data:** `2026-10-21`
- **Impacto:** médio
- **Pergunta:** Como resolver os peers de vitest sob Yarn 4?
- **Decisão:** Declarar `vite` como peer explícito nos workspaces que usam vitest.
- **Razão:** Resolução de peers mais estrita do Yarn 4 exige declaração explícita.
- **Alternativas rejeitadas:** `packageExtensions` no `.yarnrc.yml` — mais opaco e difícil de rastrear por workspace.
- **Seções atualizadas em `spec.md`:** FR-002.

### CQ-004 — Ordem do Corepack no CI

- **Data:** `2026-10-21`
- **Impacto:** médio
- **Pergunta:** Onde habilitar o Corepack nos workflows?
- **Decisão:** `corepack enable` antes do `setup-node` com `cache: yarn`.
- **Razão:** O cache do `setup-node` precisa do Yarn 4 já ativo para resolver a versão correta.
- **Alternativas rejeitadas:** Habilitar o Corepack após o `setup-node` — cache resolve com o Yarn errado.
- **Seções atualizadas em `spec.md`:** FR-004.

### CQ-005 — Oxlint no lugar do ESLint

- **Data:** `2026-10-21`
- **Impacto:** crítico
- **Pergunta:** Como rodar lint type-aware sobre o TypeScript 7?
- **Decisão:** Oxlint + `oxlint-tsgolint` type-aware, removendo ESLint e `typescript-eslint`, com paridade documentada das regras atuais e lista de regras sem equivalente.
- **Razão:** O `typescript-eslint` não funciona com o compilador nativo do TypeScript 7 (sem API pública do compilador), o que prende o projeto no `typescript` 6.0.3.
- **Alternativas rejeitadas:** Manter `typescript` 6 com alias só para o lint — rejeitada como solução final, mantida como plano B do spike do servidor.
- **Seções atualizadas em `spec.md`:** FR-005, US-003.

### CQ-006 — Node 26 e Corepack

- **Data:** `2026-10-21`
- **Impacto:** alto
- **Pergunta:** Quando e como adotar o Node 26?
- **Decisão:** Node 26 em `.node-version`, `engines`, CI e docs, com merge da frente a partir de 2026-10-28 (LTS); verificar se o Node 26 distribui o Corepack e, se não, instalá-lo explicitamente no CI e nas instruções.
- **Razão:** Alinhar o runtime à janela de LTS; Node 25+ pode não empacotar o Corepack.
- **Alternativas rejeitadas:** Adotar antes do LTS — runtime sem suporte de longo prazo.
- **Seções atualizadas em `spec.md`:** FR-007, US-004.

## Questões abertas

- Paridade da regra react-hooks no Oxlint ainda a confirmar caso a caso.
- Estratégia de build do servidor com TypeScript 7 (tsc 7, SWC ou nest build) a definir no spike; plano B mantém `typescript` 6.0.3.
- Disponibilidade do Corepack no Node 26 a verificar antes do merge.
- Runtime de hospedagem em produção ainda indefinido.

## Hipóteses remanescentes

- **Não crítica:** a lista de regras sem equivalente no Oxlint é refinada conforme a migração avança.

## Gate 1 — Clarificação aprovada

- **Status:** aprovado
- **Aprovador:** wezercarvalho
- **Data:** `2026-10-21`
- **Artefatos aprovados:** `spec.md`, `clarification.md`
- **Referência:** instrução explícita do mantenedor na sessão de 2026-10-21, com base nos critérios das issues #43, #45 e #46.
- **Observações:** o merge da frente de Node 26 ocorre a partir de 2026-10-28 (LTS); o runtime de hospedagem fica fora desta spec.
