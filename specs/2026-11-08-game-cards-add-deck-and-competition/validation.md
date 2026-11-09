# Validação

## Estado

- Spec: spec.md
- Status: validação técnica concluída; revisão final/Gate 3 e merge pendentes do maintainer.
- Data: 2026-11-08
- Executor: agente implementador.
- Base: b9335d5dba89a606a795108f00865fed8e7f411f, main após #150.
- Branch: codex/cards-deck-competitive; commit de entrega identificado na PR.

## Evidências por requisito

| Requisito                | Tarefas   | Evidência                                                                                                                                                                                                                                                                                                                       | Resultado    |
| ------------------------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| FR-001                   | T001      | Quatro cartas, três categorias, dois níveis; todas reconhecem a série de oscilação pelo mesmo createRound/árbitro. Categorias/dificuldades da UI derivam do baralho. Fallback ao texto-fonte quando futura carta ainda não tiver tradução.                                                                                      | PASS         |
| FR-002                   | T002      | Filtro categoria/dificuldade, seleção válida e estado vazio testados; troca remonta o fluxo e descarta recursos. Demonstração real seleciona Regente de orquestra.                                                                                                                                                              | PASS         |
| FR-003                   | T001/T002 | Quatro cartas traduzidas, controles/resultados/privacidade pt-BR/en-US e preferência opcional com fallback seguro; Chromium confirma idioma persistido após reload. Painel técnico e outros jogos fora da tradução.                                                                                                             | PASS         |
| FR-004                   | T001/T003 | Duração privada consumida pelo núcleo e pela UI local. HTTP real carrega carta por id/locale e avalia ângulos com relógio do servidor; score/elapsed/resultado injetados pelo cliente são recusados com 400.                                                                                                                    | PASS         |
| FR-005                   | T003      | Fórmula de pontos testada com relógio determinístico; reconhecimento HTTP real concede pontos, timeout no limite e cancelamento concedem zero. Resultado final congelado e repetição/cancelamento posteriores retornam o mesmo resultado, sem reapontuação.                                                                     | PASS         |
| FR-006                   | T004      | Aviso explícito e modo opcional. Cliente só envia cardId/locale ou angleDeg/null/seq; demonstração com MediaPipe real e câmera sintética termina por timeout no servidor e mostra zero. Falha de rede não concede pontos nem muda para treino.                                                                                  | PASS         |
| FR-007                   | T003/T004 | Capacidade/expiração/token/seq/rajada em testes de serviço; HTTP recusa origem, token, extras, locale inválido, ângulo fora de faixa e corpo >2048 B. JSON parser sem compressão, início compartilha limite por IP e varredura é descartada no shutdown. Cache-Control no-store. Limites de identidade/antifraude documentados. | PASS         |
| FR-008                   | T005      | Schemas compartilhados geram OpenAPI; teste compara métodos e caminhos reais, inclusive parâmetros POST. Contratos sincronizados. Smoke usa servidor emitido pelo TypeScript, comprovando DI/metadados e validação em clone com build.                                                                                          | PASS         |
| NFR-001                  | T001/T003 | Projeção de cada carta/idioma não contém evaluation, criterion, amplitude, basePoints ou duração privada. Sem mídia/landmarks remotos ou persistência/logs de sinais. Acesso privado só na criação, em memória do cliente.                                                                                                      | PASS         |
| NFR-002                  | T004/T005 | AsyncTrackerResource/VideoFrameGate reutilizados, uma observação pendente por vez, cancelamento por geração/AbortController, respostas tardias ignoradas e sessão tardiamente criada cancelada. Detector que falha é fechado e a UI orienta recarga da câmera. Sem dependência externa nova da aplicação.                       | PASS         |
| SC-001 / SC-002 / SC-003 | T001–T005 | Evidências acima e comandos abaixo; entrega técnica preparada para PR draft. Aceite final continua humano.                                                                                                                                                                                                                      | PASS técnico |

## Test-first e demonstração

[Contagens sanitizadas](evidence/test-first.json): núcleo inicialmente 3 falhas/68 aprovações; seleção inicialmente 3 falhas/525 aprovações; teste de serviço falhou pelo módulo ausente antes da implementação. Regressão adicional de falha do detector: 1 falha/30 aprovações antes da correção, 31 aprovações depois. O defeito demonstrado mantinha detector quebrado aberto e feedback genérico de rede; agora fecha o detector e pede parar/ativar câmera, sem pontos.

[Demonstração Chromium](evidence/browser-smoke.json): frontend compilado, servidor compilado e MediaPipe real, câmera sintética sem mão. Confirma seleção em português, carta/controles em inglês, preferência após reload, ativação, carregamento do detector, timeout autoritativo com zero e interrupção da câmera. Foram observados 40 comandos HTTP com apenas campos escalares esperados. Nenhuma mídia, credencial ou valor de ângulo foi persistido. O primeiro ensaio identificou rótulos de selects que incluíam as opções na identificação; labels explícitos associados por id corrigiram a navegação por nome acessível.

## Comandos e resultados

Node 26.12.1, Yarn 4.18.1, TypeScript 7.0.2; Linux x64. Suíte integral em Docker sem rede externa, cache instalado com instalação imutável e VITEST_MAX_WORKERS=1; host para scripts de governança, contratos e demonstração Chromium 156.0.8078.4/Playwright 1.64.1 externo. Uma instalação inicial no container sem cache tentou rede e falhou; cache local foi fornecido e a instalação imutável offline foi concluída antes da execução final.

| Comando                                                                                      | Resultado                                                                                                                                 |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| yarn install --immutable + hook; instalação offline imutável no container                    | PASS; única dependência adicionada é o workspace core já existente ao servidor, sem nova biblioteca.                                      |
| VITEST_MAX_WORKERS=1 yarn check:all                                                          | PASS na fonte final: core 71, bolinhas 174, Swing 264, servidor 104, web 533 + 79 scripts; tipos/lint/builds e smoke compilado aprovados. |
| yarn workspace @guess-my-move/server test:cards                                              | PASS, 6 testes de autoridade/limites e HTTP real.                                                                                         |
| VITEST_MAX_WORKERS=1 yarn workspace @guess-my-move/web test:cards                            | PASS, 31 testes incluindo regressões de ciclo de vida e telas existentes.                                                                 |
| yarn workspace @guess-my-move/web smoke:cards (com caminhos externos do Playwright/Chromium) | PASS, resultado sanitizado vinculado acima. Demonstração opcional, fora do gate padrão.                                                   |
| yarn contracts:check                                                                         | PASS, HTTP e Socket.IO de ambos os jogos sincronizados.                                                                                   |
| yarn test:gates                                                                              | PASS, 241 testes.                                                                                                                         |
| yarn test:sdd                                                                                | PASS, 109 testes.                                                                                                                         |
| yarn security:dependencies                                                                   | PASS, info/low/moderate/high/critical = 0; não é auditoria do binário Node.                                                               |
| yarn security:runtime                                                                        | PASS na consulta: pin/security 26.12.1, última estável 26.13.0; advisory futuro permanece em #132.                                        |
| yarn sdd:check / yarn docs:format:check                                                      | Verificados novamente pelo hook antes do push; sem aceite final presumido.                                                                |

## Decisões e limites

Português brasileiro padrão, inglês opcional, 10 s e pontos-base 100/200. Pontuação premia rapidez, sem penalidade por dica e sem ranking. Autoridade do servidor evita confiar em pontos/tempo/resultado enviados pelo dispositivo; não prova gesto físico, identidade ou presença. Cartas novas são variações oscilatórias, sem novos classificadores e sem promessa de reconhecimento semântico.

Falta teste humano com câmera física, outras pessoas/dispositivos e rede pública; não há medição de acurácia ou FPS. CI remoto será executado ao sair de draft, sem declaração de aprovação antecipada. #52/#132 seguem como acompanhamentos externos independentes; nenhuma versão futura foi simulada ou adotada como estável. Violão preservado em standby.
