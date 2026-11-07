# Validação

## Estado

- Status: em validação; Gate 3 pendente do maintainer.
- Data: 2026-11-07.
- Código validado: aca3f91; alterações posteriores apenas neste registro e no estado da spec.
- Base: main 2e4088c; issue #149.

## Evidências por requisito

| Requisito | Tarefas | Evidência                                                                                                                                                                                                            | Resultado |
| --------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| FR-001    | T001    | headLook.test.ts e swingHeadLook.test.ts: ganho nos dois eixos, limites, valores inválidos, preferência após reset/modo, suavização e detector preservado; SwingScreen.test.tsx: slider acessível local/cooperativo. | PASS      |
| FR-002    | T002    | headLook.test.ts: nova pose neutra após ausência/orientação inválida, amostras seguintes e renders repetidos; swingHeadLook.test.ts: composição no controlador.                                                      | PASS      |
| FR-003    | T003    | headLook.test.ts e swingHeadLock.test.ts: lookback, neutro no início/liberação, recuperação e alteração de ganho enquanto travado, centralização curta após travas sucessivas.                                       | PASS      |
| FR-004    | T004    | world.test.ts: consumo único por atualização, acúmulo sem passo e reset; testes de escalada com ganhos extremos; controlador cooperativo com inputs validados no schema real; suíte completa e documentação.         | PASS      |

## Decisões e regressões

- Faixa de 0,5×–3×, passo 0,1 e padrão 1×; preferência em memória da tela, preservada no reinício e na alternância de modo, sem storage.
- Recalibrar significa redefinir a pose neutra; não reposicionar o personagem. Recuperação e centralização convergem suavemente. A direção travada fica preservada; soltar usa a pose atual como neutro.
- Sensibilidade pertence ao núcleo, antes da suavização. Sinais independentes com ganho padrão mantêm o esforço da escalada.
- Corrigida a repetição de lookDelta em subpassos, demonstrada por testes vermelhos. O padrão conserva os parâmetros de ganho, sem reproduzir o giro duplicado incorreto.
- Yaw equivalente normalizado evita rejeição de inputs online após travas sucessivas e trajetos longos ao centralizar; nenhum campo novo no protocolo.
- Expectativas antigas que somavam novamente a pose ao liberar foram atualizadas conforme o novo comportamento aprovado.
- Evidência red/green: [test-first.json](evidence/test-first.json). Dados sintéticos; sem mídia, poses, apelidos ou credenciais em logs novos. NFR-001/NFR-002 e SC-001 cobertos nos testes; nenhuma alegação de FPS ou precisão física.

## Verificações

- PASS: `yarn check:all` sobre aca3f91 em contêiner Node 26.12.1/Yarn 4.18.1, com `VITEST_MAX_WORKERS=1`: typecheck, lint, testes e build; saída 0. Core 68, Marbles 174, Swing 245, servidor 98, web 514 e scripts web 79 testes aprovados. Log local persistente: `/home/codex/Documents/Codex/gmm-face-final-verified.log`.
- PASS: `yarn workspace @guess-my-move/web test:swing-look`: 65 testes dirigidos; `yarn workspace @guess-my-move/swing test`: 245 testes, incluindo os últimos casos angulares.
- PASS: `yarn check:static`, `yarn sdd:check`, `yarn test:sdd` (109 testes), `yarn docs:format:check` e `git diff --check`. O hook de pré-push reexecuta os gates locais antes da publicação.
- Artefatos red/green e limitações ficam versionados em `evidence/test-first.json`; logs operacionais permanecem locais. Dados de teste são sintéticos. Avisos DOM sobre canvas sem implementação são esperados nos testes sem GPU; nenhum teste falhou.

## Limitações e aceite humano

Câmera física e conforto dos limites precisam da conferência do maintainer em seu equipamento. Os testes automatizados usam poses sintéticas e DOM; não medem webcam/GPU. O aviso existente de tamanho do chunk Swing permanece e sua medição é acompanhada fora deste escopo (#147). O CI remoto ainda depende da execução dos gates no fluxo da PR; não se declara aprovado antecipadamente.

## Gate 3 — Convergência validada

- Veredito: pendente de revisão e teste com câmera real.
- Aprovador responsável: wezercarvalho (maintainer).
- Escopo a aceitar: sensibilidade, recuperação e trava/liberação, local/cooperativo, incluindo as correções angulares descritas.
- Riscos a avaliar: conforto da faixa e da suavização em dispositivos reais; dados sintéticos não substituem esse teste.
- Sem merge, deploy ou promoção para ready pelo agente.
