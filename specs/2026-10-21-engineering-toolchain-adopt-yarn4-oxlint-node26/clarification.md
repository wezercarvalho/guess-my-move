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

## Resultados da verificação do Node 26 (2026-10-21)

- **Corepack:** o tarball oficial do Node 26.12.1 (SHA-256 conferido) traz só `node`, `npm` e `npx`; o Corepack não é distribuído. O CI passa a rodar `npm install --global corepack@0.36.0` antes de `corepack enable`, e o README e o guia de desenvolvimento local dizem o mesmo. O Corepack 0.36.0 rodou sob o Node 26.12.1 nesta máquina.
- **Compatibilidade:** com o Node 26.12.1, `yarn check:all` (typecheck, lint, testes e build; inclui o addon nativo do `@swc/core` sob o Vitest), `yarn test:gates`, `yarn test:sdd`, `yarn security:dependencies` e o servidor compilado (`GET /api/health` 200) passaram.
- **Versão fixada:** `.node-version` em `26.12.1` e `engines` em `>=26.12.1 <27`. O Node 26 entra em LTS em 2026-10-28; o merge desta PR fica para essa data. O runtime de hospedagem continua indefinido.
- **Não verificado:** a instalação global do Corepack no passo de CI em runners hospedados do GitHub (só confirmada quando o `pr-gate` desta PR rodar).

## Resultados do spike de Oxlint e TypeScript 7 (2026-10-21)

- **Decisão:** adotar `typescript` 7.0.2 com `oxlint` 1.89.0 e `oxlint-tsgolint` 7.0.2004 (patch 2004 para o TypeScript 7.0.2). Plano B não acionado.
- **Typecheck:** `tsc` 7 passa nos cinco workspaces sem mudança de código, com `experimentalDecorators` e `emitDecoratorMetadata`.
- **Build do servidor:** o `nest build` recusa o TypeScript 7 (sem API programática). Estratégia escolhida: `tsc -p tsconfig.build.json` direto, precedido de `scripts/clean.mjs`; o `tsc` 7 emite `design:paramtypes` e o servidor compilado sobe e responde (`GET /api/health` 200, `POST /api/guess` 200 e 400 conforme o payload). SWC como emissor ficou como alternativa não usada. O `@nestjs/cli` e o `nest-cli.json` foram removidos; `yarn dev:server` usa `apps/server/scripts/dev.mjs` (`tsc --watch` mais `node --watch`).
- **Paridade de regras:** `.oxlintrc.json` liga a categoria `correctness` mais as regras type-aware e de `recommended` do `typescript-eslint` que o projeto usava (`no-floating-promises`, `no-misused-promises`, `no-unsafe-*`, `require-await`, `restrict-template-expressions`, `unbound-method`, `no-unnecessary-type-assertion`, `only-throw-error` e outras; 136 regras no total) e `react/rules-of-hooks`, `react/exhaustive-deps` e `react/only-export-components` no web. Um arquivo-sonda com violações confirmou que `no-floating-promises`, `no-unsafe-*`, `unbound-method`, `restrict-template-expressions`, `require-await`, `no-explicit-any` e `rules-of-hooks` disparam.
- **Sem equivalente verificado:** as regras de React Compiler do `eslint-plugin-react-hooks` 7 (por exemplo as de pureza e de refs) não foram confirmadas no Oxlint; `react/only-export-components` está configurada mas não foi exercida pela sonda; as regras `no-extraneous-class` e outras do conjunto `strict` do `typescript-eslint` não eram usadas no projeto.
- **Medição (SC-005, uma execução cada, nesta máquina):** `yarn check:static` (typecheck + lint) passou de 18,8 s (Yarn 1, TypeScript 6.0.3, ESLint) para 4,2 a 4,4 s (Yarn 4, TypeScript 7.0.2, Oxlint). `yarn check:all` passou de cerca de 50 s para 27,6 s. A mudança de gerenciador de pacotes também entra nesses números; não houve isolamento por ferramenta.

## Questões abertas

- Paridade das regras de React Compiler do `react-hooks` 7 e de `only-export-components`, a confirmar caso a caso.
- Runtime de hospedagem em produção ainda indefinido.
- Reavaliar o `@nestjs/cli` e o `nest build` quando o TypeScript 7.1 estabilizar a API (prevista para novembro de 2026).

## Hipóteses remanescentes

- **Não crítica:** a lista de regras sem equivalente no Oxlint é refinada conforme a migração avança.

## Gate 1 — Clarificação aprovada

- **Status:** aprovado
- **Aprovador:** wezercarvalho
- **Data:** `2026-10-21`
- **Artefatos aprovados:** `spec.md`, `clarification.md`
- **Referência:** instrução explícita do mantenedor na sessão de 2026-10-21, com base nos critérios das issues #43, #45 e #46.
- **Observações:** o merge da frente de Node 26 ocorre a partir de 2026-10-28 (LTS); o runtime de hospedagem fica fora desta spec.
