# Tarefas — 2026-10-31-game-marbles-add-online-multiplayer

## Convenções

- `[P]`: paralelizável sem conflito de arquivo, recurso ou dependência.
- `[US-nnn]`, `[FR-nnn]`, `[NFR-nnn]`, `[SC-nnn]`: rastreabilidade.
- Cada fase comportamental registra teste vermelho, implementação mínima e teste verde em `validation.md` antes da próxima fase.
- Estado desta spec: `implementing`; Gates 1 e 2 aprovados e Gate 3 autorizado antecipadamente com risco aceito pelo maintainer em 2026-10-31.

## Fase 0 — Convergência e fundação documental

- [x] T001 [US-001] [FR-001] Promover a spec singleplayer a `validated`, concluir T031 e registrar a aprovação do maintainer e os riscos aceitos sem mudar a evidência histórica.
- [x] T002 [FR-016] [NFR-006] Criar e validar esta spec, pesquisa, clarificação, plano, tarefas e catálogo; registrar issues #111, #112 e #113.

## Fase 1 — Motor e melhorias do jogo atual

- [x] T003 [US-001] [FR-002] [SC-001] Escrever testes falhando para `shotsLeft`, `opponent-turn`, `fireShot` por competidor e adversário `remote` em `packages/marbles/test/`.
- [x] T004 [US-001] [FR-002] Implementar a sessão neutra e compatibilidade local em `packages/marbles/src/match/`; confirmar equivalência dos condutores.
- [x] T005 [US-001] [FR-003] [SC-001] Escrever teste falhando do bot sem campo/alvo e implementar `null` sem tiro arbitrário, com intenção exposta antes do disparo.
- [x] T006 [US-001] [FR-004] Escrever testes falhando e implementar contador por competidor, rótulo neutro e distinção por contorno/forma no campo.
- [x] T007 [US-005] [FR-005] Rodar testes direcionados dos três modos, bot, controlador e tela local; registrar resultado da fase.

## Fase 2 — Protocolo compartilhado

- [ ] T008 [US-002] [US-003] [FR-006] [FR-010] [FR-011] [FR-014] [SC-002] Escrever testes falhando dos schemas estritos, eventos, vetor, sequência e estado versionado.
- [ ] T009 [US-002] [US-003] [FR-006] [FR-010] [FR-011] [FR-014] Implementar `packages/marbles/src/multiplayer/` e exportar a API pública; confirmar testes verdes e ausência de mídia/carta.

## Fase 3 — Sala autoritativa

- [ ] T010 [US-002] [US-003] [US-004] [FR-008] [FR-009] [FR-010] [FR-011] [FR-012] [NFR-001] [NFR-002] Escrever testes falhando do `RoomService`: código, lotação, prontidão, autoridade, sequência, tick, pausa, retomada e expiração.
- [ ] T011 [US-002] [US-003] [US-004] [FR-008] [FR-009] [FR-010] [FR-011] [FR-012] Implementar o serviço em memória com relógio e aleatoriedade injetados; confirmar testes verdes.
- [ ] T012 [US-003] [FR-009] [FR-010] [SC-003] Demonstrar uma partida de cada modo por duas fontes remotas no teste do serviço, sem bot nem regra duplicada.

## Fase 4 — NestJS e gateway WebSocket

- [ ] T013 [US-002] [FR-007] [FR-011] [NFR-004] Escrever testes falhando de configuração, health, limite de payload/comandos e acknowledgements do gateway.
- [ ] T014 [US-002] [FR-007] [FR-011] Implementar `apps/server` com NestJS 12.3.2, Socket.IO 4.8.4, health, gateway, ticker e encerramento limpo.
- [ ] T015 [US-002] [US-003] [US-004] [FR-007] [FR-012] [SC-003] [SC-004] Escrever e passar integração real com dois clientes: criar, entrar, prontidão, tiro, duplicata, desconectar e retomar.
- [ ] T016 [FR-014] [NFR-003] [NFR-004] Provar que logs/acks não expõem token, stack ou payload de mídia e que um socket infrator não derruba outra sala.

## Fase 5 — Cliente e tela online

- [ ] T017 [US-005] [FR-013] [FR-015] [SC-005] Escrever testes falhando do `MultiplayerClient`: create/join/resume/ready/shot/leave, estado, erro e `sessionStorage`.
- [ ] T018 [US-005] [FR-013] [FR-015] Implementar cliente Socket.IO pela mesma origem e driver remoto; integrar à mira sem duplicar câmera ou regras.
- [ ] T019 [US-002] [US-005] [FR-013] [SC-005] Escrever testes falhando da tela `Local | Online`, criar/entrar, código, presença, prontidão, papel, espera, própria vez e vez remota.
- [ ] T020 [US-001] [US-005] [FR-003] [FR-004] [FR-013] Implementar a tela com componentes/tokens existentes, intenção do oponente e resultado pela perspectiva local.
- [ ] T021 [US-005] [FR-005] [FR-015] Provar por teste que falha de conexão não impede modo local, e que pinça/estalo só enviam tiro na própria vez.

## Fase 6 — Demonstração, revisão e convergência

- [ ] T022 [US-002] [US-003] [US-004] [SC-003] [SC-004] Executar servidor e web locais; demonstrar em duas abas criação, entrada, prontidão, tiro, alternância, desconexão e retomada.
- [ ] T023 [US-005] [FR-013] [SC-005] Capturar evidência do fluxo e executar revisão independente de usabilidade por pessoa nova; corrigir achados materiais.
- [ ] T024 [FR-014] [SC-006] Revisar protocolo, logs e bundle para confirmar que nenhum frame, vídeo, landmark, gesto bruto, carta ou token do servidor é transmitido/logado.
- [ ] T025 [FR-016] [NFR-007] Executar `check:all`, `test:gates`, `test:sdd`, `sdd:check`, `docs:format:check` e `security:dependencies`; registrar comandos e resultados.
- [ ] T026 [FR-016] [SC-007] Atualizar README, PROJECT_SPEC, arquitetura, desenvolvimento local, catálogo e `validation.md`; revisar o diff; abrir PR em rascunho com `Closes #111`, `Closes #112` e `Closes #113`.
- [ ] T027 [FR-016] [SC-007] Reconciliar implementação, spec, tarefas e evidências; efetivar o Gate 3 aprovado e promover a spec a `validated` somente se não houver falha material.

## Cobertura

| Requisito | Tarefas                | Evidência esperada                          |
| --------- | ---------------------- | ------------------------------------------- |
| FR-001    | T001                   | spec singleplayer validada                  |
| FR-002    | T003, T004             | testes da sessão e equivalência             |
| FR-003    | T005, T020             | bot sem tiro arbitrário e intenção no campo |
| FR-004    | T006, T020             | contador/rótulo e campo acessível           |
| FR-005    | T007, T021             | regressão local verde                       |
| FR-006    | T008, T009             | schemas compartilhados                      |
| FR-007    | T013–T015              | health e gateway real                       |
| FR-008    | T010, T011             | testes do ciclo da sala                     |
| FR-009    | T010–T012              | sessão única autoritativa                   |
| FR-010    | T008–T012, T015        | validação e idempotência                    |
| FR-011    | T008–T015              | versão, estado e erro estável               |
| FR-012    | T010, T011, T015       | pausa, retomada e expiração                 |
| FR-013    | T017–T020              | cliente e tela online                       |
| FR-014    | T008, T009, T016, T024 | schema/log sem mídia                        |
| FR-015    | T017, T018, T021       | mesma origem e fallback local               |
| FR-016    | T002, T025–T027        | SDD, gates e PR draft                       |

## Dependências e paralelismo

- T001–T002 antecedem código. T003–T007 estabilizam o núcleo antes do protocolo.
- T008–T009 fixam o contrato consumido por servidor e web.
- Após T009, o servidor (T010–T016) e os testes iniciais do cliente (T017) podem avançar sem editar os mesmos arquivos; a integração final é serializada.
- T022–T027 dependem de todas as implementações anteriores. Testes pesados e builds rodam em série por causa da memória do host.

## Análise de consistência

- **Status:** aprovada
- **Revisor:** kirocrew (agente), com aprovação antecipada do maintainer
- **Data:** `2026-10-31`
- **Lacunas:** nenhuma; FR-001 a FR-016 têm tarefa e evidência. Identidade, matchmaking público, persistência, chat, escala horizontal e métricas não medidas estão fora de escopo.

## Gate 2 — Plano e tarefas aprovados

- **Status:** aprovado
- **Aprovador:** wezercarvalho (maintainer)
- **Data:** `2026-10-31`
- **Artefatos aprovados:** `research.md`, `plan.md`, `tasks.md`
- **Referência:** mensagem do maintainer nesta sessão: "Pode considerar todos os gates aceitos, se precisar pode segmentar em issues".
- **Exceções:** novo servidor, Socket.IO e credencial efêmera foram aceitos como complexidade necessária; evidência final continua obrigatória.
