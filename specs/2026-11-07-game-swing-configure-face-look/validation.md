# Validação

## Estado

- Status: em validação; Gate 3 pendente do maintainer.
- Data: 2026-11-07.
- Código validado: c860780; alterações posteriores apenas nos registros da spec.
- Base: main 2e4088c; issue #149.

## Evidências por requisito

| Requisito | Tarefas    | Evidência                                                                                                                                                                                                                                                                                                                                  | Resultado |
| --------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| FR-001    | T001       | headLook.test.ts e swingHeadLook.test.ts: ganho nos dois eixos, limites, valores inválidos, preferência após reset/modo, suavização e detector preservado; SwingScreen.test.tsx: slider acessível local/cooperativo.                                                                                                                       | PASS      |
| FR-002    | T002       | headLook.test.ts: nova pose neutra após ausência/orientação inválida, amostras seguintes e renders repetidos; swingHeadLook.test.ts: composição no controlador.                                                                                                                                                                            | PASS      |
| FR-003    | T003       | headLook.test.ts e swingHeadLock.test.ts: lookback, neutro no início/liberação, recuperação e alteração de ganho enquanto travado, centralização curta após travas sucessivas.                                                                                                                                                             | PASS      |
| FR-004    | T004, T005 | world.test.ts: consumo único por atualização, acúmulo sem passo e reset; testes de escalada com ganhos extremos; controlador cooperativo com inputs validados no schema real; centralização suave da câmera inteira em repouso/movimento/agarre sem reposicionar o personagem; suíte completa e documentação.                              | PASS      |
| FR-005    | T006, T008 | climb.test.ts: velocidade vertical efetiva, parada, topSpeed, saída sem impulso, topo e limite inferior; swingHeadLock.test.ts: HUD durante escalada; impulso de teia preservado com velocidade prévia 0/+6/-6, sem inércia ao lançar sem puxão.                                                                                           | PASS      |
| FR-006    | T007       | world.test.ts: âncora virtual disponível a 500 m, ausente a 500,01 m; prédio válido a 510 m. DEFAULT_SWING compartilhado por cliente e catálogo do servidor.                                                                                                                                                                               | PASS      |
| FR-007    | T009       | headTurn.test.ts: espera de 1 s, sentidos, histerese, amostra repetida, frame longo, ganho e reset; headLook.test.ts: frente acumulada e sinais preservados; swingHeadLook/Lock/Climb: giro, parada, teclado, reinício, limites posicionais antes da espera, comandos online estritos; guide.test.ts: espera/direção/parada e precedência. | PASS      |

## Decisões e regressões

- Faixa de 0,5×–3×, passo 0,1 e padrão 1×; preferência em memória da tela, preservada no reinício e na alternância de modo, sem storage.
- Recalibrar preserva a posição do personagem. O botão Centralizar também nivela a câmera efetiva ao horizonte e rumo contextual (fachada, deslocamento, direção inicial). Recuperação e centralização convergem suavemente. A direção travada fica preservada; soltar usa a pose atual como neutro.
- Sensibilidade pertence ao núcleo, antes da suavização. Sinais independentes com ganho padrão mantêm o esforço da escalada.
- Corrigida a repetição de lookDelta em subpassos, demonstrada por testes vermelhos. O padrão conserva os parâmetros de ganho, sem reproduzir o giro duplicado incorreto.
- Yaw equivalente normalizado evita rejeição de inputs online após travas sucessivas e trajetos longos ao centralizar; nenhum campo novo no protocolo.
- Expectativas antigas que somavam novamente a pose ao liberar foram atualizadas conforme o novo comportamento aprovado.
- Evidência red/green: [test-first.json](evidence/test-first.json). Dados sintéticos; sem mídia, poses, apelidos ou credenciais em logs novos. NFR-001/NFR-002 e SC-001 cobertos nos testes; nenhuma alegação de FPS ou precisão física.

## Verificações

- PASS: `yarn check:all` sobre c860780 em contêiner Node 26.12.1/Yarn 4.18.1, com `VITEST_MAX_WORKERS=1`: typecheck, lint, testes e build; saída 0. Core 68, Marbles 174, Swing 260, servidor 98, web 522 e scripts web 79 testes aprovados. Log local persistente: `/home/codex/Documents/Codex/gmm-turn-check-all.log`.
- PASS: `yarn workspace @guess-my-move/web test:swing-look`: 72 testes dirigidos, log gmm-turn-web-verified.log; `yarn workspace @guess-my-move/swing test`: 260 testes, incluindo velocidade, fronteira de 500 m e giro contínuo.
- PASS: `yarn check:static`, `yarn sdd:check`, `yarn test:sdd` (109 testes), `yarn docs:format:check` e `git diff --check`. O hook de pré-push reexecuta os gates locais antes da publicação.
- Artefatos red/green e limitações ficam versionados em `evidence/test-first.json`; logs operacionais permanecem locais. Dados de teste são sintéticos. Avisos DOM sobre canvas sem implementação são esperados nos testes sem GPU; nenhum teste falhou.

## Emendas após o teste do maintainer

- O teste demonstrou que apenas recalibrar o rosto deixava a inclinação efetiva residual. O botão passa o resíduo da câmera ao mesmo suavizador do núcleo, sem criar um segundo pipeline. Usa a fachada agarrada, o rumo horizontal significativo (mínimo existente de 8 m/s), ou a direção inicial em repouso; pitch alvo zero.
- Velocity agora representa a escalada real e topSpeed a inclui. A saída do regime zera os componentes no mesmo objeto usado pelo integrador e restaura apenas o impulso deliberado calculado pelos comandos de teia no passo; não transmite impulso de subida/descida. A posição não desce abaixo do chão; distância continua horizontal. Sem novo campo no schema.
- Pedido seguinte do maintainer ampliou o limite de 220 para 500 m inclusive. Distância/elevação da âncora virtual e mira dos prédios permaneceram iguais. Teste red/green e documentos atualizados.

## Revisão e giro contínuo

- A revisão demonstrou perda do impulso do punho ao sair da parede. A diferença de velocidade criada pelos comandos é passada como contexto interno ao integrador, preservando o impulso sem herdar a escalada e sem alterar o contrato de rede.
- Novo pedido do maintainer: manter a cabeça de lado por 1 s gira continuamente. Taxa 30°/s no padrão, escalada pela sensibilidade, histerese, amostras renovadas e cancelamento nas saídas. HeadLook incorpora o giro na frente/histórico; escalada mantém sinais próprios. Pitch permanece posicional. O painel informa espera/direção e como parar.
- Retornar ao centro perto de 1 s revelou disparo indevido durante a cauda de suavização. intentYaw instantâneo separa intenção da suavização visual e cancela a espera sem afrouxar tolerâncias. Testes antigos de pose limitada agora observam a janela anterior a 1 s ou pose dentro da zona neutra; testes de trava continuam verificando o lookback existente.
- A tentativa completa sobre 07fac85 passou núcleo/servidor, mas falhou por timeout de 5 s no teste web de modo automático. Fixtures agora reusam canvas e no-op de desenho, evitando DOM/logs e vi.fn descartáveis por quadro; o conjunto final passou sem aumentar timeout. Não se atribui ganho de FPS do jogo a essa mudança de fixture.

## Limitações e aceite humano

Câmera física e conforto dos limites precisam da conferência do maintainer em seu equipamento. Os testes automatizados usam poses sintéticas e DOM; não medem webcam/GPU. O aviso existente de tamanho do chunk Swing permanece e sua medição é acompanhada fora deste escopo (#147). O CI remoto ainda depende da execução dos gates no fluxo da PR; não se declara aprovado antecipadamente.

## Gate 3 — Convergência validada

- Veredito: pendente de revisão e teste com câmera real.
- Aprovador responsável: wezercarvalho (maintainer).
- Escopo a aceitar: sensibilidade, recuperação e trava/liberação, centralização nivelada, escalada com velocidade indicada e limite virtual de 500 m, local/cooperativo, giro contínuo após 1 s e impulso ao sair da parede, incluindo as correções descritas.
- Riscos a avaliar: conforto da faixa e da suavização em dispositivos reais; dados sintéticos não substituem esse teste.
- Sem merge, deploy ou promoção para ready pelo agente.
