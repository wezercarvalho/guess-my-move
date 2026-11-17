# Validação

## Estado

- **Spec:** [spec.md](spec.md)
- **Status:** aprovado (proposto para o incremento, condicionado ao merge pelo maintainer)
- **Constituição:** 1.0.0
- **Data:** 2026-11-16
- **Executor/revisor:** GitHub Actions; agente assistente (conciliação); wezercarvalho (aprovação condicionada ao merge).
- **Commit:** head de implementação `a5d13a8c008515aec41a64a179b85d4e2fe90af1`; merge sintético testado `cca503cd6d1a7b381956afc4db34c3afd797d880`; árvore `feb312a234389eadaff2837e87d8b05912219c4f`.

## Evidências por requisito

| Requisito | Tarefas    | Evidência                                                                                                            | Resultado |
| --------- | ---------- | -------------------------------------------------------------------------------------------------------------------- | --------- |
| FR-001    | T001, T005 | Teste de licença legada e conflitos aprovado; três locators MIT reclassificados no CI.                               | PASS      |
| FR-002    | T002, T005 | Índices web e servidor gerados; verificação de blob e cópia dos avisos upstream completadas.                         | PASS      |
| FR-003    | T003, T005 | Log ASSET-ENTRY confirma hashes dos modelos, estrutura ZIP, JS/WASM, fontes e dados ODbL.                            | PASS      |
| FR-004    | T004, T005 | Spec #177 reconciliada, política de não distribuir mantida; declaração para aceite do incremento na própria PR #180. | PASS      |

## Comandos e evidências

Execução oficial [43997274737](https://github.com/wezercarvalho/guess-my-move/actions/runs/43997274737) em 16/11/2026 BRT (17/11 UTC): 5/5 jobs aprovados.

- PASS: `yarn install --immutable`.
- PASS: `yarn test:sdd` (109/109), `yarn sdd:check`, `yarn docs:format:check` e `yarn test:gates` (251/251), incluindo regressão de declaração legada e paridade de paths; [log de governança](https://github.com/wezercarvalho/guess-my-move/actions/runs/43997274737/job/133752365102).
- PASS: `yarn check:all` (typecheck, lint, testes, build, smoke compilado e contratos).
- PASS: `yarn licenses:inspect`; [log de código e inspeção](https://github.com/wezercarvalho/guess-my-move/actions/runs/43997274737/job/133752365070): 15 candidatos externos na web e 111 no servidor, avisos copiados e verificados. MIT/OFL/ODbL preservados; não houve empacotamento de servidor em container ou distribuição de artefato.
- PASS: auditorias de dependências e runtime Node; [job de segurança](https://github.com/wezercarvalho/guess-my-move/actions/runs/43997274737/job/133752365082), zero achados npm na consulta; runtime 26.13.1.
- PASS: [gate obrigatório](https://github.com/wezercarvalho/guess-my-move/actions/runs/43997274737/job/133752943846).
- FAIL: [CI da consolidação documental 43997627630](https://github.com/wezercarvalho/guess-my-move/actions/runs/43997627630), head `6303f99aa763f263b49a2d48cb3c25bcfed57c86`. `sdd:check` rejeitou link local para pesquisa histórica removida da árvore atual; código e auditorias passaram. Corrigido o link para o commit histórico verificado; aguardar CI da correção antes de merge.
- BLOCKED: execução oficial RED e hook local não disponíveis no ambiente da integração. Commit de teste anterior à implementação `342cb8548151158aec35cc927c31f600729ec16e`; RED por ausência da função na base. GREEN comprovado no CI.
- BLOCKED: liberação jurídica/artifact-specific de redistribuição pública e confirmação integral de avisos; fora do aceite deste incremento e ainda acompanhadas pela #179.

## Inventário e inspeção

- 346 locators: 237 declared-and-notice-present, sete workspace, 95 not-installed, seis notice-review e um patch-review; nenhum license-review. Busboy, streamsearch e xmlhttprequest-ssl passam a MIT com aviso. @tokenizer/token e MediaPipe continuam notice-review porque os avisos suplementares não equivalem a confirmar o binário completo.
- Os três hashes externos dos .task correspondem aos pins em prepare-assets: mão `fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1`, gestos `97952348cf6a6a4915c2ea1496b4b37ebabc50cbbf80571435643c455f2b0482`, face `64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff`. O modelo de gestos contém hand_landmarker.task e hand_gesture_recognizer.task, este com gesture_embedder.tflite e canned_gesture_classifier.tflite. O hand_landmarker incorporado tem hash diferente do arquivo de mão independente. O facial também contém geometry_pipeline_metadata_landmarks.binarypb (19.376 bytes); o relatório enumera essa entrada, sem interpretar seu conteúdo. Consultar ASSET-ENTRY para hashes individuais dos arquivos inspecionados.
- As fontes no build conferem com a pesquisa original de design: DM Sans, 36.932 bytes, SHA-256 `9fea608a947e67020c33cad9a6fe3d60c54119dfb8cff87768a8117a15ed7543`; Space Grotesk, 22.288 bytes, SHA-256 `0640890476fc1198ab4de571fb658de443c4d85b66466ec09534a8737ab1ce9d`. Avisos OFL preservados, origem anterior ao site não reconstituída completamente.
- Os três mapas e o aviso ODbL conferem byte a byte com os originais do repositório, conforme inspeção.

### Proveniência MediaPipe

O [colaborador do projeto](https://github.com/google-ai-edge/mediapipe/issues/6355#issuecomment-5997480830) declara Apache-2.0 para código e modelos, salvo exceções. A [confirmação do SDK](https://github.com/google-ai-edge/mediapipe/issues/6306#issuecomment-4673728357) também é Apache-2.0. Nenhuma exceção específica localizada nas fontes consultadas; não substitui inventário de componentes embutidos. A comparação manual com [third_party/wasm_files.bzl em v1.1.1](https://github.com/google-ai-edge/mediapipe/blob/50505c8312c7eacb1bd411cecdc4cc9fd08d53cb/third_party/wasm_files.bzl) constatou divergência em seis de seis hashes:

| Arquivo                          | SHA-256 observado no build                                       | SHA-256 declarado na tag v1.1.1                                  |
| -------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------- |
| vision_wasm_internal.js          | 6522286aa32dd93eff17c3da002b0649516f87abfec7a80b5bfe5c9625caa5f8 | 41cf300b4d13a2219b9b773039bd890e6d1ba95613ecdee7c0973b80719b689a |
| vision_wasm_internal.wasm        | 0e101a010e262ef8e78f22e3c95b60a9705fd06962753c9acd6356d9fb56b7bd | 77323865c969efe8ff587e30a4c741b97ddbddc6fcd3650bc1d05af7e145265f |
| vision_wasm_module_internal.js   | 539a4386fd12d0723d6e900ec80467d168ba7290dda2f79e77a2181b8e906115 | f15e5c3f7d2b4fcc03eb74b3261a515524952d657d5996e03184edb86894b64f |
| vision_wasm_module_internal.wasm | 3b57e4b55ac6346bf940212e3e11250b308a6a474077385e2f527b119cf74525 | 0497c3c2eccacd55c3b8ed1850a9b2caf794635c4f2f1b15a4114555f727f541 |
| vision_wasm_nosimd_internal.js   | 942654dbdcebce08ea039af23d18e58bebf23c8607d74023d2df7071c8a7b638 | 17e4d51c91432b96216c3445dcec14997c3c5433bf8c2f423a184eebc3625e35 |
| vision_wasm_nosimd_internal.wasm | c9b1b69bb87baf9e529254d8559dcbcf4c5a9c0eda84f56a12f17d675335ec9c | 4f53178b9d69f8412e3be92c63db2861bce33ebc9d53418efa16232a32df68ba |

Não se conclui violação de licença, adulteração ou que a árvore-fonte seja necessariamente outra. Não atribuir os componentes embutidos, incluindo Eigen, a um commit sem confirmação suficiente. Buscar do fornecedor a associação de origem e avisos ou outra evidência apropriada. Nenhum arquivo de modelo foi republicado.

## Constitution Check final

Escopo autorizado, regras/privacidade, dependências e lockfile preservados. Teste de regressão foi preparado antes da implementação; limitação da execução RED/local documentada. Nenhum serviço adicional pago, publicação, deploy, merge pelo agente, Codex ou Work. A spec #177 é reconciliada sem PR separada. Este incremento é completo pelos seus próprios critérios; não completa os critérios de liberação da issue #179. O diff documental final requer CI verde do head final antes do merge; os resultados acima são do commit de implementação testado, não uma alegação sobre execução futura.

## Gate 3 — Convergência validada

- **Veredito:** aprovado com risco aceito
- **Aprovador:** wezercarvalho (maintainer, aceite efetivado somente por merge na main após checks do head final)
- **Data:** 2026-11-16
- **Escopo aprovado:** FR-001 a FR-004 e SC-001 a SC-004 deste incremento de evidências da PR #180; não se estende à decisão de liberar builds públicos.
- **Riscos aceitos:** execução local indisponível, compensada pelo CI; classificação conservadora de candidatos e inspeção limitada a hashes/ZIP; os bloqueios de redistribuição permanecem, responsável: maintainer na #179.
- **Observações:** Gates 1 e 2 autorizados por “Pode considerar aprovados”; proposta de Gate 3 condicionada ao merge conforme fluxo estabelecido. Data, autor e commit do merge serão comprovados pelo GitHub. Refs #179 porque a issue ainda contém trabalho necessário. Não encerrar por merge parcial.
