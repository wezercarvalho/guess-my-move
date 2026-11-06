# Validação

## Estado

- Status: validação técnica concluída; aceite final do maintainer pendente.
- Data: 2026-11-06.
- Branch: refactor/marbles-capture-input; commit identificado na PR.

## Evidências por requisito

| Requisito | Tarefas | Evidência                                                                                                                                    | Resultado |
| --------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| FR-001    | T001    | handInput.test.ts: pinça, estalo, perda de mão, ausência de vez e resets; 37 testes de entrada/controlador.                                  | PASS      |
| FR-002    | T002    | Adoção real de AsyncTrackerResource e VideoFrameGate; 8 testes compartilhados; regressão de erro de inferência permanece error após liberar. | PASS      |
| FR-003    | T003    | Tipos reexportados e fachada preservada; 125 testes de controles de bolinhas e suíte web serial com 498 testes + 79 scripts.                 | PASS      |

## Test-first

Teste de erro de inferência e suíte de entrada precederam a produção: duas suítes vermelhas (import ausente e status idle em vez de error), com 33 regressões anteriores aprovadas. Após extração: test:marbles-input com 37 testes, test:marbles-controls com 125 e suíte web completa com 498 + 79 scripts aprovados. A base inclui o teste vermelho/verde de cancelamento reentrante de quadro, sem rearmar callback depois do descarte.

## Validação integrada

`VITEST_MAX_WORKERS=1 yarn check:all` aprovado no container Node 26.12.1, configuração padrão do servidor (SWC), sem substituição de testes: tipos/lint, core 68, bolinhas 174, Swing 234, servidor 98, web 498 + 79 scripts e builds. Sem rede no container; modelos oficiais de MediaPipe reaproveitados e conferidos pelo prepare:assets. Tentativas anteriores falharam na preparação do ambiente (primeiro cópia sem dist de dependências, depois modelos ausentes/copiados num subdiretório); cópia corrigida, agregado repetido e exit 0 confirmado. Nenhuma configuração de produção ou teste foi relaxada.

`yarn contracts:check` conferiu http.openapi.json, swing.socketio.json e multiplayer.socketio.json sem alterações. SDD e formatação aprovados antes do push; auditoria npm da composição final sem achados, registrada no incremento de runtime. Build preserva aviso não bloqueante de chunk Swing acima de 500 kB; não é medição de FPS. CI padrão aguarda sair de rascunho.

## Decisões e limites

O tradutor devolve vetor/feedback local; controlador preserva jogo, bot, efeitos e autoridade online. Estado de erro de inferência não é sobrescrito por idle ao liberar detector. Reset de turno preserva histórico de estalo; reset de sessão limpa esse histórico. Responsabilidades antes/depois constam no guia de arquitetura. Sem alteração de gestos, limiares, mapas, regras, renderer ou formato de rede.

NFR-001/NFR-002 preservadas: nenhuma mídia/log/persistência nova, contratos privados e carta preservados. Câmera simulada/DOM não substituem câmera/GPU física; teste humano permanece com o maintainer. T001–T003 concluídas; Gate 3 não presumido, sem merge/deploy.

## Gate 3 — Convergência validada

- Veredito: pendente de revisão final da PR.
- Aprovador: maintainer.
- Escopo técnico demonstrado: FR-001–FR-003, NFR-001–NFR-002 e SC-001.
