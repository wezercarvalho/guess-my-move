# Plano

## Resumo técnico

Atualizar o pin e a faixa mínima do Node na mesma major e reconciliar referências vigentes, mantendo lockfile e CI. O monitor existente já fornece evidência vermelha no pin anterior.

## Contexto técnico

- **Runtime/versões:** Node 26.12.1 para 26.13.1; Yarn 4.18.1 e Corepack 0.36.0 inalterados.
- **Dependências:** sem alterações em manifests de dependências ou lockfile.
- **Provedores externos e persistência:** nenhuma mudança.
- **Testes:** scripts oficiais do monorepo, auditorias e cenários de multiplayer.
- **Restrições:** sem merge, deploy, Codex, Work, mudança de workflow ou flexibilização de checks.

## Constitution Check — pré-design

- PASS: escopo e limites foram aprovados pelo mantenedor.
- PASS: falha real preexistente do monitor documentada; nenhuma alteração publicada na main.
- PASS: privacidade, contratos, regras, custo e autorização preservados.

## Pesquisa e decisões

A [execução do monitor em 15/11/2026](https://github.com/wezercarvalho/guess-my-move/actions/runs/43732104155) registrou 26.12.1 como pin e 26.13.1 como release de segurança posterior, com exit 1. O [boletim oficial](https://nodejs.org/en/blog/vulnerability/november-2026-security-releases) e a [nota da versão](https://nodejs.org/en/blog/release/v26.13.1) são fontes de referência. O backend usa HTTP nativo e Socket.IO; não se presume exposição direta a falhas específicas de outros protocolos nem ausência de risco. Não há pesquisa de nova arquitetura.

## Estrutura afetada

- `.node-version` e `package.json`: pin e engines.
- `README.md` e guias de operação e runtime: referências vigentes.
- Esta spec, seus artefatos e o catálogo.
- O CI já utiliza `.node-version`; não alterar workflows.

## Design

Manter a faixa da major 26 e elevar seu mínimo. Preservar referências históricas datadas; registrar a publicação e as limitações de exposição. Revisar o diff estático antes de deixar PR em draft.

## Mapeamento de requisitos

- FR-001: pin e engines coerentes, documentação, auditoria de runtime.
- FR-002: check:all, smoke compilado, cenários de salas, retomada e revanche nos dois jogos online.
- FR-003: contratos, teste dos gates, SDD, formatação e auditorias.
- FR-004: registro de comandos, resultados, riscos e PR vinculada à issue.

## Estratégia test-first

1. Usar a falha existente do monitor na main como RED observado, sem reproduzir desnecessariamente uma execução já registrada.
2. Atualizar somente configuração e documentação.
3. Conferir a consistência dos arquivos e executar a auditoria de runtime no novo pin (GREEN ainda a demonstrar).
4. Executar regressões, contratos e governança no ambiente atualizado.
5. Registrar evidências e solicitar aceite após validação; sem refatoração não requerida.

## Riscos, rollout e rollback

- Incompatibilidade com módulos nativos ou runtime: impedir integração até investigar testes/build; a branch é isolada.
- Falha de registry ou de obtenção do binário: registrar bloqueio; manter critérios.
- Não reintroduzir versão vulnerável como rollback operacional sem análise e autorização.
- CI não roda completamente em draft; promoção e validação permanecem dependentes de ação autorizada.

## Constitution Check — pós-design

- PASS: abordagem mínima, sem alterar dados, contratos, código dos jogos ou política existente.
- PASS: plano distingue RED observado, GREEN pendente e aceite humano.
- PASS: risco residual explicitado; a main e os ambientes implantados permanecem intactos.

## Complexidade e desvios

Nenhum desvio de escopo requerido. A evidência RED é a execução existente; não se cria teste artificial para a simples mudança de pin. O hook local e os comandos oficiais ainda precisam de execução em ambiente apropriado.
