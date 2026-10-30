# Validação — 2026-10-30-game-guitar-build-air-chords-poc

## Estado

- **Spec:** `spec.md`
- **Status:** em andamento
- **Constituição:** 1.0.0
- **Data:** `2026-10-30`
- **Executor/revisor:** kirocrew (agente)
- **Commit:** último commit da branch `feat/95-violao-no-ar` na PR consolidada

## Resumo do resultado

Veredito do agente: **convergente para os critérios automatizáveis**, **não validado ao vivo**. Todos os requisitos funcionais têm testes automatizados passando e a tela abriu num Chromium real com o MediaPipe real, sem erro no console. **Nenhum teste foi feito com uma mão real**, e nenhuma precisão, latência ou taxa de quadros foi medida. O Gate 3 não é concedido pelo agente: depende do teste ao vivo do maintainer.

## Conclusão das tarefas

- **Concluídas:** 41 de 41 (T001 a T041).
- **Pendentes:** 0.
- **Evidência:** `tasks.md`.

## Evidências por requisito

| Requisito | Tarefas                | Evidência                                                                                                           | Resultado |
| --------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------- | --------- |
| FR-001    | T005, T006             | `HomePage.test.tsx`: quatro cards, selo Alpha só no Violão no Ar; captura do menu no Chromium                       | PASS      |
| FR-002    | T007, T008             | `pages.test.mjs`: `guitar.html`, link "← Menu" e entrada do Vite; `guitar.html` presente no `dist`                  | PASS      |
| FR-003    | T003, T004             | `Badge.test.tsx`; `design-tokens.test.mjs` (sem `#hex` solto em `design.css`)                                       | PASS      |
| FR-004    | T001, T002, T009, T010 | `chords.test.ts`: tríade de cada acorde, afinação, ordem de ensino, dedilhado, tipos exportados                     | PASS      |
| FR-005    | T011, T012             | `board.test.ts`: casas 1 a 5 e casa 12, células, canhoto, zona de batida                                            | PASS      |
| FR-006    | T014, T015             | `hands.test.ts`: lado da tela, rótulo certo, trocado e ausente, canhoto, uma mão, margem da divisa                  | PASS      |
| FR-007    | T013, T016, T017       | `oneEuro.test.ts`, `fingers.test.ts`: permanência, histerese (com e sem margem), polegar, fora do braço, tolerância | PASS      |
| FR-008    | T018, T019             | `evaluate.test.ts`: certo, falta, errado, abafada, casa mais alta, extras e `ignoreExtraFingers`                    | PASS      |
| FR-009    | T018, T019             | `evaluate.test.ts`: correção única e ordem determinística                                                           | PASS      |
| FR-010    | T020                   | `evaluate.test.ts`: `ChordStability` não pisca com um quadro ruim e não aceita acerto de passagem                   | PASS      |
| FR-011    | T021, T022             | `strum.test.ts`: direção, força, escala 2x, limiar, zona, refratário, salto de posição, reinício                    | PASS      |
| FR-012    | T023, T024             | `synth.test.ts`: fundamental a menos de 1% (A2, E3, E4, G4), decaimento, determinismo                               | PASS      |
| FR-013    | T025                   | `strumPlan.test.ts`: ordem, atraso, ganho, abafadas, formato errado                                                 | PASS      |
| FR-014    | T026, T027             | `audioPlayer.test.ts`: bloqueado, desbloqueio por gesto, agendamento, falhas; ativar a câmera libera o áudio        | PASS      |
| FR-015    | T028, T029, T030, T031 | `guitarController.test.ts`, `GuitarScreen.test.tsx` (teste de fumaça); tela no Chromium com MediaPipe real          | PASS      |
| FR-016    | T033, T034, T035       | `guide.test.ts`, `ChordDiagram.test.tsx`, `GuitarScreen.test.tsx`: escolha, diagrama, etapas, dicas, progresso      | PASS      |
| FR-017    | T036, T037             | `GuitarScreen.test.tsx`: gaveta, ajuste do braço, teclado, botões, ignorar extras; gaveta aberta no Chromium        | PASS      |

## Histórias e critérios de aceitação

| História/cenário        | Demonstração                                                                                                                 | Resultado |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------- |
| US-001 / cenários 1 e 2 | Menu com quatro cards e selo Alpha; `guitar.html` abre com o link "← Menu" (teste e captura no Chromium)                     | PASS      |
| US-002 / cenários 1 a 3 | Testes de `evaluate` e da tela: Em certo, falta o dedo 3, D com a corda 6 abafada ignorada                                   | PASS      |
| US-003 / cenários 1 a 4 | Teste de fumaça: batida para baixo toca as seis cordas, para cima inverte, formato errado muda a nota, áudio bloqueado avisa | PASS      |
| US-004 / cenários 1 e 2 | Diagramas dos cinco acordes; batida com o formato certo conclui o acorde e sugere o próximo                                  | PASS      |
| US-005 / cenários 1 e 2 | Gaveta com todos os números; Espaço, seta para cima e botões tocam o alvo com a câmera negada                                | PASS      |

## Comandos executados

| Comando exato            | Data       | Resultado | Evidência/observação                                                                                                                  |
| ------------------------ | ---------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `yarn check:all`         | 2026-10-30 | PASS      | Saída 0 em 1m20s: lint 0 avisos e 0 erros; testes core 68, guitar 92, marbles 111, swing 127, web 328 e `node:test` 57; build do Vite |
| `yarn sdd:check`         | 2026-10-30 | PASS      | Catálogo, estados, gates, cobertura e links válidos                                                                                   |
| `yarn test:sdd`          | 2026-10-30 | PASS      | 109 testes                                                                                                                            |
| `yarn docs:format:check` | 2026-10-30 | PASS      | Todos os arquivos no estilo do Prettier                                                                                               |
| `yarn test:gates`        | 2026-10-30 | PASS      | 231 testes                                                                                                                            |

## Medições e benchmark (quando aplicável)

- **Protocolo e amostra:** nenhuma medição de acerto, latência ou quadros por segundo foi feita. Não há câmera nem mão real no ambiente do agente.
- **Métricas:** não aplicável. Os 92 testes do pacote e os 82 da tela usam landmarks sintéticos (só números) e um `AudioContext` simulado.
- **Limitações:** no Chromium do ambiente, com uma câmera falsa (padrão de teste verde, sem mão), o jogo das bolinhas, que já existia, e o Violão no Ar caem igualmente de 61 para 2 quadros/s ao ligar a câmera. Isso indica o custo do MediaPipe nesse ambiente (a GPU não foi confirmada) e **não é uma medida do desempenho real** nem uma regressão do novo jogo.

## Validações estruturais e documentais

- **Links e catálogo:** `yarn sdd:check` passou; a spec está no catálogo `specs/README.md` com o estado `validating`.
- **Contratos:** o pacote `@guess-my-move/guitar` exporta os tipos de geometria, acorde e afinação que os outros módulos e a tela consomem; `yarn workspace @guess-my-move/web typecheck` passou.
- **Privacidade e segredos:** `apps/web/scripts/guitar-privacy.test.mjs` proíbe rede, armazenamento, leitura de pixels, gravação de mídia, `console.*`, URL de terceiros e arquivo de áudio nos arquivos do pacote e da tela, e prova que enxerga cada padrão; nenhuma chave de provedor foi adicionada. Nenhum quadro é gravado nem enviado.
- **Fronteira de informação:** não se aplica (não há carta nem IA jogadora neste jogo).
- **UTF-8 e acentuação:** preservados; `yarn docs:format:check` passou.
- **Alterações fora de escopo:** `apps/web/src/tracker/mediapipeTracker.ts` ganhou o `realTwoHandLoader` (duas mãos só com landmarks) e o `realMediaPipeLoader` passou a vir da mesma função com `numHands` igual a 1, sem mudar o comportamento; os testes do rastreador seguem verdes. O `design.css` ganhou o `.ds-badge`.
- **Verificação visual:** no Chromium do ambiente (Playwright, câmera falsa), o menu mostra os quatro cards com o selo Alpha só no novo; a tela do jogo mostra o braço sobre o vídeo espelhado, os alvos 2 e 3 do Em, as marcas de corda solta, a zona de batida e o status "Mostre a mão esquerda no braço."; o MediaPipe real carregou ("Graph successfully started running") com 0 erros no console; a gaveta de depuração abre com `aria-expanded` verdadeiro e mostra todos os números e o ajuste do braço. As capturas ficaram fora do repositório. Defeitos achados e corrigidos na inspeção: o botão do acorde G cortado, o botão de depuração esticado, os controles em azul fora da paleta e a latência desconhecida exibida como "0 ms".

## Constitution Check final

| Princípio/gate                              | Resultado | Evidência ou desvio aprovado                                                                                                                      |
| ------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Intenção antes da implementação          | PASS      | Gates 1 e 2 registrados antes do código (aprovação antecipada **inferida** do pedido do maintainer, ver os gates).                                |
| II. Uma fonte vigente                       | PASS      | `spec.md` é a fonte; plano, tarefas e validação referenciam IDs.                                                                                  |
| III. Rastreabilidade                        | PASS      | Matriz acima; cada FR com tarefa formal e evidência.                                                                                              |
| IV. Test-first e incremental                | PASS      | Cada módulo começou por testes vistos falhando; os testes de contraste da histerese e da batida foram corrigidos quando provaram não discriminar. |
| V. Evidência honesta                        | PASS      | Nenhuma precisão, latência ou fps afirmada; limitações listadas abaixo.                                                                           |
| VI. Fronteira, privacidade e segredos       | PASS      | Teste de varredura; sem rede, sem armazenamento, sem chave.                                                                                       |
| VII. Neutralidade e contexto sob demanda    | PASS      | Sem regra de provedor de agente; contexto técnico atualizado em `docs/`.                                                                          |
| VIII. Clareza, preservação, operação segura | PASS      | UTF-8; os três jogos existentes seguem verdes.                                                                                                    |

## Convergência

- **Divergências encontradas:** a issue #95 dizia "extras ignorados por padrão", em conflito com o critério da #99; a decisão CQ-003 da spec mantém o dedo extra como erro e deixa `ignoreExtraFingers` como parâmetro. Os parâmetros da palma ficaram 2 Hz, beta 0,5 e dcutoff 2 (o plano dizia 1 Hz e 0,4): o plano foi atualizado.
- **Artefatos reabertos:** nenhum.
- **Reexecuções:** `yarn check:all` rodou duas vezes (a segunda depois do ajuste de CSS e do painel de depuração); a segunda é a registrada.

## Limitações e riscos residuais

| Limitação/risco                                                                                                        | Impacto                                                              | Responsável | Aceite             |
| ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ----------- | ------------------ |
| Nunca testado com mão real: a separação das pontas dos dedos e os falsos positivos de dedo são hipóteses (H-01 e H-02) | O reconhecimento pode errar dedos ou exigir ajuste do braço          | maintainer  | pendente do Gate 3 |
| Sem profundidade (z), um dedo só passando sobre o braço pode contar como apertando                                     | Status "tire o dedo" para um dedo que o jogador não apertou          | maintainer  | pendente do Gate 3 |
| Limiar da batida, refratário, permanência, suavização, atraso entre cordas e decaimento são palpites (H-03)            | Batidas perdidas ou duplas; som sem o timbre esperado                | maintainer  | pendente do Gate 3 |
| Latência fim a fim e quadros por segundo não medidos (H-04)                                                            | Pode haver atraso perceptível entre a batida e o som                 | maintainer  | pendente do Gate 3 |
| O áudio só é liberado por um gesto do usuário; a batida pela mão sozinha não o libera                                  | Antes do primeiro clique ou tecla a batida pela mão não soa          | maintainer  | pendente do Gate 3 |
| Gates 1 e 2 foram aprovados de forma antecipada e inferida do pedido, não por uma frase de aprovação dos gates         | O maintainer pode rejeitar e a spec volta ao primeiro estado afetado | maintainer  | pendente           |

## Gate 3 — Convergência validada

- **Veredito:** pendente
- **Aprovador:** pendente do maintainer (wezercarvalho)
- **Data:** pendente
- **Escopo aprovado:** pendente
- **Riscos aceitos:** pendente
- **Observações:** o agente não concede o Gate 3. O teste ao vivo com a câmera, a mão e o notebook do maintainer, usando a gaveta de depuração, decide o veredito (`aprovado`, `aprovado com risco aceito` ou `rejeitado`).
