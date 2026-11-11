# Validação

## Estado

- Status: entrega técnica em PR draft; teste físico do maintainer pendente.
- Data: 2026-11-10.
- Base: main 9b439b522f7b06598fe5553374e85b4453f96bf8.
- Escopo: #156–#162; sem merge ou publicação.

## Evidências por requisito

| Requisito | Tarefa     | Evidência                                                                                                                                           | Resultado                                |
| --------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| FR-001    | T001       | preparation.test.ts: rosto válido, estabilidade, frames repetidos e perda; controlador percorre o fluxo facial completo.                            | PASS sintético                           |
| FR-002    | T001       | preparation.test.ts: sequência e sinais invertidos; controlador integra correção ao pipeline facial.                                                | PASS sintético                           |
| FR-003    | T001, T002 | Seletores explícitos, guias alinhados por containRect, uma/duas mãos e alternativa teclado; interface e browser.                                    | PASS automatizado                        |
| FR-004    | T001, T002 | Positivo filtrado/consumido; guarda de comandos/contadores, reinício e fluxo completo no controlador.                                               | PASS sintético                           |
| FR-005    | T003       | SwingOnline.test.tsx: prontidão e perda; browser com servidor compilado e dois clientes, vídeo permanece montado.                                   | PASS loopback                            |
| FR-006    | T004       | eyeAssist.test.ts: calibração, validação independente, falha sem variação e erro alto; UI alpha desligada inicialmente.                             | PASS sintético                           |
| FR-007    | T004       | Correção limitada, sem acúmulo, exclusão de HUD, perda/piscada/pose extrema e geometria relativa; trava preserva deslocamento ocular até liberação. | PASS sintético                           |
| FR-008    | T005       | manual-test.md, evidence/browser.json, scripts oficiais e PR draft.                                                                                 | Roteiro entregue; câmera física pendente |

## Test-first e integração

Primeira execução de preparation.test.ts e eyeAssist.test.ts falhou por módulos ausentes. O teste de bloqueio no controlador falhou com uma teia antes da confirmação; depois passou. O teste cooperativo falhou porque o botão permitia pronto antes da preparação; depois passou. Regressões suplementares cobrem reinício parcial e validação ocular rejeitada. Logs operacionais locais em /tmp; nenhum frame foi salvo.

O primeiro smoke de navegador encontrou rótulo acessível não exato no seletor; aria-label explícito corrigiu. O smoke final usa build real, Chromium com WebGL por software, câmera sintética sem rosto e servidor Nest compilado. Seus limites estão em evidence/browser.json. O teste não mede acurácia dos detectores com uma pessoa.

## Comandos

- `yarn install --immutable`: PASS com Node 26.12.1 e Yarn 4.18.1.
- `yarn check:all`: PASS sobre 02a200c (71 core, 84 guitar, 174 marbles, 279 swing, 104 server, 4 lobby e 617 web; scripts Node, build e smoke do servidor também aprovados). O ajuste posterior de foco é coberto novamente por static, suítes de controlador/interface, build e smoke de navegador.
- `yarn workspace @guess-my-move/swing test test/preparation.test.ts test/eyeAssist.test.ts`: PASS; regressões suplementares registradas no resultado final.
- `yarn workspace @guess-my-move/web test:swing-network`: PASS, 39 testes.
- `yarn workspace @guess-my-move/web test:swing-look`: PASS, 75 testes.
- `yarn workspace @guess-my-move/web smoke:swing-preparation`: PASS; Playwright externo 1.64.1, Chromium 156.0.8078.4. Variáveis `GMM_PLAYWRIGHT_PATH` e `GMM_CHROMIUM_PATH` apontam para instalação externa; não é dependência do app.
- `yarn sdd:check`: PASS estrutural após completar metadados.

## Limitações e riscos

Não há câmera física nesta validação. Óculos, luz, anatomia e movimentos podem inviabilizar o ocular: a validação rejeita erro alto e a flag permanece desligada por padrão. A normalização ocular compensa translação/escala/inclinação comum, não elimina toda distorção de perspectiva; a assistência suspende fora de 10° da pose calibrada. Nenhuma precisão ou latência de webcam foi anunciada como medida.

O teste anterior de controles usa `guidedPreparation: false` apenas na injeção de dependências para isolar gestos existentes; o app real resolve true por padrão, e novos testes de fluxo usam a guarda habilitada. O smoke executa o build sem bypass.

## Constitution Check final

- PASS: processamento e parâmetros locais; nenhuma mídia/landmark transmitida ou persistida; carta e protocolos preservados.
- PASS: requisitos e testes rastreáveis, limitações explícitas, autorização humana registrada.

## Gate 3 — Entrega para teste

Gates autorizados antecipadamente pelo maintainer nesta conversa. A entrega técnica será mantida em draft; #161 e a parte de usabilidade real de #162 aguardam execução do roteiro pelo maintainer. Não se declara teste físico concluído nem autorização de merge.

## Refinamentos de integração

- Regressão vermelha de alternância rápida de lados confirmou aceitação indevida; manter o sinal durante a janela corrigiu o caso.
- Regressão vermelha de sessão online confirmou envio tardio de giro acumulado ao recalibrar; a suspensão agora descarta esse acumulador antes do próximo input neutro.
- O ambiente isolado recusou o cache nativo do SWC por propriedade virtual de diretórios/noexec. Os gates completos são executados fora desse isolamento, sem alterar permissões do sistema nem dependências.

- A execução completa expôs uma corrida no teste antigo de Centralizar: ele aguardava câmera ativa, mas não o carregamento assíncrono do detector facial. O teste agora aguarda o estado do detector antes de alimentar frames, sem aumentar timeout nem alterar comportamento de produção.

- Smoke sem clique adicional no cenário demonstrou que o foco permanecia no botão de início, bloqueando Espaço. A confirmação por teclado agora transfere foco ao canvas e aceita comandos novos imediatamente, descartando somente os anteriores.

## Governança e auditoria

- `yarn test:sdd`: PASS, 109 testes.
- `yarn test:gates`: PASS, 241 testes.
- `yarn security:dependencies`: PASS, nenhuma vulnerabilidade reportada.
- `yarn docs:format:check`: PASS.
- `git diff --check`: PASS.

O CI remoto permanece intencionalmente sem execução enquanto a PR é draft, conforme o workflow do repositório. Os resultados locais não são apresentados como resultado do CI.

## Entrega disponível

[PR #163](https://github.com/wezercarvalho/guess-my-move/pull/163), draft, atribuída a @wezercarvalho. Código entregue em 1941826; alterações posteriores somente finalizam este registro. O push passou pelo hook local (test:sdd, sdd:check, docs:format:check e check:static). T005 concluída com roteiro e evidências automatizadas disponíveis. A spec permanece validating enquanto o maintainer testa a câmera física; #161 permanece em andamento e nenhuma issue foi encerrada.

## Reteste solicitado pelo maintainer — calibração na cidade

Após feedback de 2026-11-10, FR-003 passa a usar ponto no centro geométrico da cidade, instrução/progresso junto ao ponto e controles de preparação no próprio cenário. O preview é apoio de enquadramento; o neutro é olhar para a cidade. A opção ocular está desabilitada até retomada futura, conforme FR-006 revisado; os resultados sintéticos anteriores de FR-006/FR-007 não representam usabilidade aprovada.

- Regressão de UI falhou quando a preparação ainda estava na lateral; passou após mover os elementos para o cenário.
- `yarn workspace @guess-my-move/swing test`: PASS, 279 testes.
- `yarn workspace @guess-my-move/web test`: PASS, 617 testes e 87 testes de scripts.
- `yarn workspace @guess-my-move/web test:swing-look`: PASS, 75 testes, repetidos após ajuste final das mensagens centrais.
- `yarn build`: PASS; `yarn workspace @guess-my-move/web build` repetido após o ajuste final: PASS.
- `yarn workspace @guess-my-move/web smoke:swing-preparation`: PASS. Mede alinhamento ao centro e ausência de sobreposição em 1280×720, 1920×1080 e 640×360, com câmera inativa e câmera sintética ativa. Preserva início por teclado, reinício e prontidão de dois clientes. Detectou sobreposição em janela baixa, corrigida aumentando o espaço mínimo e reduzindo o preview. O teste aguarda o contador de teias em vez de presumir atualização visual em 300 ms.
- `yarn check:all`: FAIL nesta revisão por timeout de 5 s, repetido duas vezes, no teste preexistente de progressão da taxa por nível em `packages/marbles/test/bot.test.ts`. Não houve alteração nesse jogo nem no timeout; os testes do escopo e o build foram executados separadamente. O PASS anterior permanece histórico e não substitui este resultado.
- `yarn sdd:check`, `yarn docs:format:check` e `git diff --check`: PASS.

A PR #163 continua draft para novo teste do maintainer. A qualidade com câmera física permanece pendente em #161; #162 foi adiada. Não houve merge nem publicação.

## Conferência após merge — 2026-11-11

A PR #163 foi integrada pelo maintainer em 2026-11-11 às 06:03:36 UTC, commit `ada2c4b244567cee414fe939e94050aba4994f72`, na branch padrão main. O conteúdo coincide integralmente com `bd3f1ed01fb718b2d222f3ef82f02a058599321b`. O [pr-gate remoto](https://github.com/wezercarvalho/guess-my-move/actions/runs/42969579726) passou para esse head: check:all, governança e gate obrigatório. O timeout local anterior de bolinhas não se repetiu nesse CI; sua ocorrência histórica continua registrada.

As entregas técnicas #156–#160 estão integradas e têm testes automatizados e evidência de navegador; a validação física permanece concentrada em #161. #162 continua trabalho futuro: o controle ocular está indisponível e o usuário pediu retomar apenas após a conferência das pendências.

Na conferência inicial pós-merge ainda faltava relato físico. O maintainer posteriormente informou o resultado abaixo. A spec permanece validating para acompanhar a cobertura ampliada; não se exige repetir o teste básico já realizado nem se apresenta a matriz completa como executada.

### Reteste informado pelo maintainer — 2026-11-11

- Calibração na área da cidade considerada boa; navegação breve pelo mapa funcionou adequadamente.
- Duas mãos testadas e funcionando.
- Nenhuma perda da câmera percebida durante o uso; não houve relato de interrupção deliberada para testar recuperação.
- Iluminação adequada. O maintainer adiou explicitamente a evolução de iluminação para depois.

Relato qualitativo de uso real, sem contagens, tempos, câmera ou navegador informados. Registra aceite inicial do fluxo testado. Negativos de gestos, interrupção/reconexão provocada e cooperativo não foram relatados; ficam como acompanhamento em #161. Este relato não comprova precisão ocular. Responsável: @wezercarvalho. Fonte: mensagens do maintainer nesta conversa, incluindo “Testei com as duas mãos e funcionou. Não identifiquei perda da câmera. De momento mantive iluminação adequada. Posteriormente evoluímos a questão da iluminação.”

### Limpeza de branches

A branch remota feat/swing-guided-calibration já estava excluída no GitHub; a referência local foi removida após comprovar ancestralidade e árvore idêntica à main. Também foram removidas 11 branches remotas antigas de PRs encerradas, todas com zero commits ausentes da main e sem worktree usando a branch: codex/cards-deck-competitive, codex/swing-bundle-study, codex/toolchain-release-readiness, docs/post-merge-review, fix/multiplayer-session-recovery, fix/realtime-transport-admission, refactor/backend-public-projections, refactor/capture-resources, refactor/marbles-capture-input, refactor/swing-session-input e test/marbles-real-client-lobby. Cada remoção usou lease do SHA conferido. Branches de outros worktrees foram preservadas; fix/61-codex-prompt-aliases local também foi preservada porque sua ancestralidade na main não foi comprovada. O worktree desta conversa foi reutilizado para este registro documental.
