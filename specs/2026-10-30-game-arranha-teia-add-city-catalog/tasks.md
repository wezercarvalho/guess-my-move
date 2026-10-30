# Tarefas — 2026-10-30-game-arranha-teia-add-city-catalog

## Convenções

- `[P]`: paralelizável sem conflito de arquivo, recurso ou dependência.
- `[US-nnn]`, `[FR-nnn]`, `[NFR-nnn]`: rastreabilidade.
- Uma tarefa só é marcada `[x]` após atender seu critério de conclusão.
- Estado desta spec: `validating`; Gates 1 e 2 aprovados pelo maintainer em 2026-10-30.

## Fase 1 — Catálogo e seleção test-first

- [x] T001 [US-001] [FR-001] [FR-008] Escrever `cityCatalog.test.ts` falhando para catálogo válido, id desconhecido e caminhos externos; implementar parser e resolução por id.
- [x] T002 [US-001] [FR-002] [FR-003] Escrever testes falhando de `CitySelect`/`SwingApp` para selecionar antes de montar o jogo, URL direta, erro e voltar; implementar componentes.
- [x] T003 [US-001] [FR-003] Adaptar `SwingScreen`/`useSwingGame` para mapa dinâmico e demonstrar nome, atribuição e descarte ao trocar.

## Fase 2 — Pipeline e Avenida Paulista

- [x] T004 [P] [US-002] [FR-005] Escrever testes falhando da projeção/configuração por cidade e parametrizar `city-from-osm.mjs`/`build-city.mjs` com `city-sources.mjs`.
- [x] T005 [US-002] [FR-004] Gerar `paulista.json` por uma consulta pequena da Overpass; registrar bbox, rotação, data, bytes, prédios, vias e cobertura de altura.
- [x] T006 [US-002] [FR-004] [FR-006] Criar `cities.json` com Midtown e Paulista; ampliar `city-data.test.mjs` para validar catálogo, arquivos e índice.

## Fase 3 — Passe visual procedural

- [x] T007 [P] [US-003] [FR-007] Escrever teste falhando das opções/materiais locais do renderizador e implementar iluminação, fachadas e ruas mais legíveis sem recurso externo nem mudança no `City`.
- [x] T008 [US-003] [FR-007] Rodar regressões do pacote swing, geometria, mira e tela; remover qualquer efeito que quebre o funcionamento.

## Fase 4 — Demonstração e convergência

- [x] T009 [US-001] [US-002] [US-003] [SC-001] [SC-002] [SC-004] Verificar em Chromium 390/900/1440: seleção, dois mapas, troca, rede e console; screenshots fora do repositório.
- [x] T010 [FR-001] [FR-002] [FR-003] [FR-004] [FR-005] [FR-006] [FR-007] [FR-008] Atualizar relatório #82, README, arquitetura, spec e catálogo.
- [x] T011 [NFR-003] [SC-003] Executar scripts oficiais: `check:all`, `test:gates`, `test:sdd`, `sdd:check`, `docs:format:check`, `security:dependencies` e registrar resultados reais.
- [x] T012 [SC-001] [SC-002] [SC-003] [SC-004] Reconciliar código, docs e evidência em `validation.md`; deixar Gate 3 pendente do teste do maintainer.

## Cobertura

| Requisito | Tarefas    | Evidência esperada                      |
| --------- | ---------- | --------------------------------------- |
| FR-001    | T001, T010 | parser e teste de caminho local         |
| FR-002    | T002, T010 | testes de tela/estados e Chromium       |
| FR-003    | T002, T003 | montagem/desmontagem e troca            |
| FR-004    | T005, T006 | catálogo e dois arquivos locais         |
| FR-005    | T004, T010 | testes do conversor/build parametrizado |
| FR-006    | T006, T010 | auditoria Node do catálogo/dados/índice |
| FR-007    | T007, T008 | teste do renderizador e regressões      |
| FR-008    | T001, T002 | URL válida/ausente/desconhecida         |

## Dependências e paralelismo

- T001 antecede T002/T003; T004 antecede T005/T006; T007 pode começar depois da spec, mas a integração T008 espera os mapas.
- T009 espera T003, T006 e T008. T010 a T012 fecham a entrega.

## Análise de consistência

- **Status:** aprovada
- **Revisor:** kirocrew (agente)
- **Data:** `2026-10-30`
- **Lacunas:** nenhuma; FR-001 a FR-008 têm tarefa, teste e demonstração planejados. O Rio/Cesium está explicitamente fora de escopo.

## Gate 2 — Plano e tarefas aprovados

- **Status:** aprovado
- **Aprovador:** wezercarvalho (maintainer)
- **Data:** `2026-10-30`
- **Artefatos aprovados:** `research.md`, `plan.md`, `tasks.md`
- **Referência:** mensagem no chat: "aplica da melhor forma possível mantendo o funcionamento que já possuímos ou até mesmo aperfeiçoando se possível. Esse é teu objetivo. Pode seguir no PR/branch que já existe para essa questão dos mapas."
- **Exceções:** nenhuma; o agente escolheu o caminho local recomendado e mantém o Rio/Cesium como incremento posterior.

## Fase 5 — Emenda CQ-001: Santa Maria

- [x] T013 [US-002] [FR-004] [FR-005] Atualizar primeiro os testes do catálogo e das fontes para exigir Santa Maria e observar a falha.
- [x] T014 [US-002] [FR-004] [FR-005] Definir o recorte central, gerar `santa-maria.json` pela Overpass e registrar bbox, rotação, bytes, prédios, vias e cobertura de altura.
- [x] T015 [US-001] [US-002] [FR-004] [FR-006] Incluir Santa Maria no catálogo e nos testes de tela/dados; validar arquivo, índice de colisão e altura inicial.
- [x] T016 [US-001] [SC-001] [SC-004] Demonstrar seleção e partida em Santa Maria no navegador, incluindo lançamento por teclado, console e requisições.
- [x] T017 [NFR-003] [SC-003] Rodar os scripts oficiais aplicáveis, atualizar a validação e devolver a spec a `validating` com o Gate 3 ainda pendente.

### Análise de consistência da emenda

- **Status:** aprovada
- **Revisor:** kirocrew (agente)
- **Data:** `2026-10-30`
- **Cobertura:** FR-004/FR-005/FR-006 e SC-001/SC-003/SC-004 cobertos por T013–T017; nenhum contrato ou componente novo.

### Gate 2 da emenda

- **Status:** aprovado
- **Aprovador:** wezercarvalho (maintainer)
- **Data:** `2026-10-30`
- **Referência:** mensagem no chat pedindo Santa Maria como seleção na mesma branch e aviso ao concluir.
- **Exceções:** nenhuma; a emenda reaplica o pipeline local já aprovado.
