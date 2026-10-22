---
id: 2026-10-21-engineering-toolchain-adopt-yarn4-oxlint-node26
title: Adoção da toolchain de engenharia (Yarn 4, Oxlint/TypeScript 7, Node 26)
slug: engineering-toolchain-adopt-yarn4-oxlint-node26
strategy: sdd
domain: engineering
capability: toolchain
objective: adopt-yarn4-oxlint-node26
summary: Modernizar a toolchain do monorepo adotando Yarn 4.18.1 via Corepack, Oxlint com tsgolint sobre o TypeScript 7 no lugar do ESLint e Node 26, preservando gates, auditoria e comportamento da aplicação.
status: implementing
owners:
    - wezercarvalho
reviewers: []
aliases:
    - yarn 4
    - oxlint
    - tsgolint
    - typescript 7
    - node 26
    - toolchain
    - corepack
code_paths:
    - package.json
    - .yarnrc.yml
    - yarn.lock
    - scripts/
    - test/
    - .github/workflows/
    - tsconfig.base.json
    - .node-version
    - apps/
    - packages/
related_specs:
    - 2026-10-20-vision-gesture-recognition-validate-waving-poc
supersedes: []
branch: chore/43-yarn4
constitution_version: 1.0.0
created_at: 2026-10-21
updated_at: 2026-10-21
---

# Adoção da toolchain de engenharia (Yarn 4, Oxlint/TypeScript 7, Node 26)

## Resumo

Modernizar a toolchain do monorepo em três frentes empilhadas: Yarn 4.18.1 via Corepack com `nodeLinker: node-modules` e instalação reproduzível; substituição do ESLint por Oxlint com `oxlint-tsgolint` type-aware sobre o compilador nativo do TypeScript 7; e adoção do Node 26 em `.node-version`, `engines`, CI e documentação. A mudança preserva os gates oficiais, a política de auditoria de dependências e o comportamento da aplicação.

## Problema

O repositório usa Yarn 1 (em manutenção), ESLint com `typescript-eslint` e Node 24. O `typescript-eslint` não funciona com o compilador nativo do TypeScript 7 (que não expõe API pública do compilador), razão pela qual o projeto está preso em `typescript` 6.0.3. Yarn 1 não recebe mais evolução e o Node 26 entra em LTS em 2026-10-28. Sem modernizar a toolchain, o monorepo não avança para o TypeScript 7 nem alinha o runtime com a janela de suporte de longo prazo.

## Objetivos

- Adotar Yarn 4.18.1 via Corepack com `nodeLinker: node-modules`, lockfile regenerado preservando versões resolvidas e instalação reproduzível por `yarn install --immutable`.
- Migrar scripts e workspaces para `yarn workspaces foreach --all --topological`, com peers de vitest (`vite`) explícitos.
- Manter a política de auditoria de dependências (High/Critical bloqueiam) sobre `yarn npm audit` em duas execuções por ambiente.
- Rodar lint e checagem de tipos sobre o TypeScript 7 com Oxlint + `oxlint-tsgolint`, sem ESLint e sem `typescript-eslint`, com paridade documentada das regras atuais.
- Comprovar que os decorators do NestJS funcionam no build do servidor sob o TypeScript 7.
- Adotar Node 26 em `.node-version`, `engines`, CI e documentação, tratando a disponibilidade do Corepack.

## Fora de escopo

- Trocar o gerenciador de pacotes por outro que não o Yarn 4.
- Plug'n'Play (PnP) como estratégia de linker.
- Validação por schema (Zod) de entradas, objeto de outra spec.
- Qualquer mudança de comportamento do jogo.
- Definição do runtime de hospedagem em produção.

## Atores

- **Colaborador:** instala dependências e roda os gates localmente com Yarn 4.
- **CI (workflows):** executa `pr-gate`, `dependency-audit` e hook sobre Yarn 4 e Node de `.node-version`.
- **Auditor de dependências:** aplica a política High/Critical em duas execuções por ambiente.
- **Mantenedor:** aprova gates e decide o plano B do spike do servidor.

## Histórias de usuário

### US-001 — Instalar e rodar os gates com Yarn 4 (P1)

Como colaborador, quero instalar o monorepo e rodar os gates com Yarn 4 para trabalhar com o gerenciador modernizado e instalação reproduzível.

**Teste independente:** em um clone limpo, habilitar o Corepack, rodar `yarn install --immutable` sem alterar o lockfile e executar `yarn check:all`.

**Critérios de aceitação:**

1. **Dado** um clone limpo, **quando** `yarn install --immutable` roda, **então** instala sem alterar o lockfile.
2. **Dado** o monorepo instalado, **quando** `yarn check:all` roda, **então** termina verde.

### US-002 — Barrar vulnerabilidade High/Critical como antes (P1)

Como CI, quero manter a política de auditoria sobre Yarn 4 para que vulnerabilidades High/Critical continuem bloqueando o pipeline.

**Teste independente:** rodar `yarn security:dependencies` com e sem registry disponível e verificar o código de saída e a mensagem.

**Critérios de aceitação:**

1. **Dado** o registry disponível, **quando** a auditoria roda em produção e desenvolvimento, **então** sai 0 sem advisories High/Critical.
2. **Dado** o registry inacessível, **quando** a auditoria roda no hook, **então** apenas avisa e não falha o hook.

### US-003 — Lint e typecheck rápidos no TypeScript 7 (P1)

Como colaborador, quero lint e checagem de tipos sobre o TypeScript 7 com Oxlint para remover o acoplamento ao `typescript-eslint` e destravar o compilador nativo.

**Teste independente:** rodar o lint/typecheck sobre o TypeScript 7 e conferir a paridade documentada das regras atuais.

**Critérios de aceitação:**

1. **Dado** o Oxlint + `oxlint-tsgolint`, **quando** o lint roda, **então** não usa ESLint nem `typescript-eslint`.
2. **Dado** o conjunto de regras atual, **quando** a migração é documentada, **então** há paridade e lista de regras sem equivalente.

### US-004 — Servidor compilado sobe sob o TypeScript 7 (P1)

Como mantenedor, quero comprovar que os decorators do NestJS funcionam no build do servidor sob o TypeScript 7 para garantir que a injeção de dependências permanece íntegra.

**Teste independente:** compilar o servidor pela estratégia escolhida, subir o processo e chamar `GET /api/health`.

**Critérios de aceitação:**

1. **Dado** o servidor compilado, **quando** sobe, **então** `GET /api/health` responde 200.
2. **Dado** o spike irrecuperável, **quando** o decorator não funciona, **então** o projeto mantém `typescript` 6.0.3 e registra o bloqueio.

## Requisitos funcionais

- **FR-001:** O repositório DEVE declarar `packageManager: yarn@4.18.1` via Corepack e `.yarnrc.yml` com `nodeLinker: node-modules`; o lockfile DEVE ser regenerado preservando as versões resolvidas; a instalação DEVE ser reproduzível por `yarn install --immutable`.
- **FR-002:** Os scripts raiz DEVEM usar `yarn workspaces foreach --all --topological`; os peers de vitest (`vite`) DEVEM ser declarados explicitamente nos workspaces.
- **FR-003:** O auditor DEVE usar `yarn npm audit` em duas execuções (`--environment production` e `--environment development`) com a mesma política (High/Critical bloqueiam, exceções com validade); a falha de registry DEVE apenas avisar no hook.
- **FR-004:** `pr-gate`, `dependency-audit` e o hook DEVEM usar Yarn 4; `corepack enable` DEVE ocorrer antes do `setup-node` com `cache: yarn`.
- **FR-005:** Lint e checagem de tipos DEVEM rodar sobre o TypeScript 7 com Oxlint + `oxlint-tsgolint` (type-aware), sem `typescript-eslint` e sem ESLint; a migração DEVE documentar a paridade das regras atuais (`recommendedTypeChecked`, react-hooks, react-refresh) e a lista de regras sem equivalente.
- **FR-006:** Os decorators do NestJS (`experimentalDecorators`, `emitDecoratorMetadata`) DEVEM funcionar comprovadamente no build do servidor (servidor compilado sobe, `GET /api/health` 200, injeção de dependências íntegra); a estratégia de build escolhida DEVE ser registrada na clarificação. Se o spike falhar de forma irrecuperável, o projeto DEVE manter `typescript` 6.0.3 e registrar o bloqueio.
- **FR-007:** O Node 26 DEVE constar em `.node-version`, `engines` e documentação; o CI DEVE instalar a versão de `.node-version`; se o Node 26 não distribuir o Corepack, o CI e as instruções DEVEM instalar o Corepack explicitamente.

## Requisitos não funcionais

- **NFR-001:** As dependências DEVEM ficar em versão exata e a auditoria DEVE estar verde.
- **NFR-002:** A mudança NÃO DEVE alterar o comportamento da aplicação.
- **NFR-003:** Os gates oficiais (`check:all`, `test:gates`, `test:sdd`, `sdd:check`, `docs:format:check`) DEVEM permanecer verdes.

## Edge cases

- Clone limpo com lockfile desatualizado: `yarn install --immutable` deve falhar em vez de alterar o lockfile silenciosamente.
- Registry inacessível no hook: a auditoria apenas avisa e não bloqueia o hook.
- Node 26 sem Corepack empacotado: o CI e as instruções instalam o Corepack explicitamente.
- Regra atual de lint sem equivalente no Oxlint: registrada na lista de regras sem paridade, sem removê-la silenciosamente.
- Spike de decorators do NestJS irrecuperável: manter `typescript` 6.0.3 e registrar o bloqueio.

## Hipóteses e dependências

- O Node 26 entra em LTS em 2026-10-28; o merge da frente de Node ocorre a partir dessa data.
- O Corepack pode não ser distribuído com o Node 25+, exigindo instalação explícita (a verificar).
- O `oxlint-tsgolint` fornece checagem type-aware compatível com o compilador nativo do TypeScript 7.
- O runtime de hospedagem em produção permanece indefinido e não condiciona esta spec.

## Critérios mensuráveis de sucesso

- **SC-001:** `yarn install --immutable` num clone limpo instala sem alterar o lockfile.
- **SC-002:** `yarn check:all` termina verde.
- **SC-003:** `yarn security:dependencies` sai 0 sem advisories e sai 1 com `registry-indisponivel` quando o registry está inacessível.
- **SC-004:** O servidor compilado responde `GET /api/health` com 200.
- **SC-005:** O tempo de typecheck+lint antes e depois é medido e registrado (sem promessa de meta).
