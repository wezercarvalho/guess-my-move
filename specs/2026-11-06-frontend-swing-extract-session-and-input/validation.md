# Validação

## Estado

- Status: validação técnica concluída; aceite final do maintainer pendente.
- Data: 2026-11-06.
- Branch: refactor/swing-session-input; commit identificado na PR.

## Evidências por requisito

| Requisito | Tarefas | Evidência                                                                                                                                                                       | Resultado |
| --------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| FR-001    | T001    | onlineSession.test.ts: 10 Hz, soma de deltas, cópia do snapshot, previsão limitada, pausa/desconexão/stale, nova partida e reaplicação após reset.                              | PASS      |
| FR-002    | T002    | Recursos compartilhados com 7 testes e adoção efetiva; regressões de quadro único para mãos/rosto, carregamento, erro, liberação e câmera simulada.                             | PASS      |
| FR-003    | T003    | handInput.test.ts neutraliza perda de mãos; 73 testes dos controladores/gestos e suíte web completa mantêm contratos reexportados, calibração, espelhamento, teclado e cleanup. | PASS      |

## Test-first e comandos

Novos testes de sessão/sinais precederam os módulos: duas suítes falharam por imports ausentes. Após extração: **6 testes dirigidos** e **73 de integração de controles** aprovados. VITEST_MAX_WORKERS=1 yarn workspace @guess-my-move/web test aprovou **493 testes + 79 scripts**. A correção posterior de fixture de erro na base de captura foi revalidada nos 7 testes compartilhados; nenhuma política de produção mudou depois do agregado web.

Tipos/lint e builds dos workspaces aprovados. A configuração padrão do servidor não foi modificada; limitações de Docker/SWC e alternativa compilada estão registradas nas specs anteriores. Não houve modificação de backend neste incremento; a base integrada tem 98 testes de servidor aprovados e contratos conferidos. SDD e formatação conferidos antes do push; CI padrão aguarda sair de draft.

## Decisões e convergência

O adaptador online não conhece câmera, detector, renderer ou React. Controller recebe room/playerId para renderizar e mantém calibração/regra local. Detector assíncrono e callbacks de vídeo têm posse/cancelamento por componentes pequenos. O tradutor das mãos recebe estado mínimo e mantém exatamente geometria/limiares anteriores. Tipos públicos são reexportados pelo caminho antigo.

Reset de sessão evita ignorar o mesmo snapshot ao remontar um mundo e descarta deltas de uma partida anterior. Recursos carregados depois de câmera desligada não são instalados. Essas condições são demonstradas sem alterar mapas, regras ou prometer FPS.

## Limites e constituição

NFR-001/NFR-002 preservadas: sem mídia externa, logs ou persistência nova, com privacidade da base aprovada. Só câmera simulada/teclado e DOM de teste; câmera/GPU física permanecem para validação humana. Não houve merge ou deploy. T001–T003 concluídas e rastreabilidade demonstrada; Gate 3 não inferido.

## Gate 3 — Convergência validada

- Veredito: pendente de revisão final da PR.
- Aprovador: maintainer.
- Escopo técnico demonstrado: FR-001–FR-003, NFR-001–NFR-002 e SC-001.
