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
