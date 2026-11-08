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

- **Concluídas:** 47 de 47 (T001 a T047).
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
| FR-008    | T018, T019, T042-T044  | `evaluate.test.ts`: cinco formatos por corda+casa, independência do dedo, parcial e extra                           | PASS      |
| FR-009    | T018, T019, T042-T044  | `evaluate.test.ts` e `GuitarScreen.test.tsx`: formato inválido fica sem nome e sem som                              | PASS      |
| FR-010    | T020, T043, T044       | `ChordRecognition`: permanência, tolerância a quadro ruim e troca Em→Am                                             | PASS      |
| FR-011    | T021, T022, T045       | `strum.test.ts`: direção, força, escala, limiar, deslocamento, jitter, refratário e reinício                        | PASS      |
| FR-012    | T023, T024             | `synth.test.ts`: fundamental a menos de 1% (A2, E3, E4, G4), decaimento, determinismo                               | PASS      |
| FR-013    | T025                   | `strumPlan.test.ts`: ordem, atraso, ganho, abafadas e entrada vazia                                                 | PASS      |
| FR-014    | T026, T027             | `audioPlayer.test.ts`: bloqueado, desbloqueio por gesto, agendamento, falhas; ativar a câmera libera o áudio        | PASS      |
| FR-015    | T028-T032, T046        | Controlador, tela e inspeção Chromium: câmera na largura útil e braço com 18% da altura                             | PASS      |
| FR-016    | T033-T035, T044        | Sem seletor; nome e diagrama aparecem somente após reconhecer a posição                                             | PASS      |
| FR-017    | T036, T037, T046       | Ajuste do braço, gaveta, teclado e clique como teste de som                                                         | PASS      |

## Histórias e critérios de aceitação

| História/cenário        | Demonstração                                                                                                     | Resultado |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- | --------- |
| US-001 / cenários 1 e 2 | Menu com quatro cards e selo Alpha; `guitar.html` abre com o link "← Menu" (teste e captura no Chromium)         | PASS      |
| US-002 / cenários 1 a 3 | Cinco acordes reconhecidos por posição, dedilhado alternativo aceito e formato parcial/extra sem nome            | PASS      |
| US-003 / cenários 1 a 4 | Trajetória para baixo/cima toca o acorde reconhecido; jitter e formato inválido não tocam; áudio bloqueado avisa | PASS      |
| US-004 / cenários 1 e 2 | Nenhum acorde começa selecionado; nome e diagrama aparecem após reconhecimento; batida pede outro acorde         | PASS      |
| US-005 / cenários 1 e 2 | Gaveta mostra posições reais; Espaço, seta para cima e botões testam o último acorde ou Em inicial               | PASS      |

## Comandos executados

| Comando exato                | Data       | Resultado | Evidência/observação                                                                                                                                                          |
| ---------------------------- | ---------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `yarn check:all`             | 2026-10-30 | PASS      | Saída 0 em 1m53s sobre a `main` atual (depois do rebase): lint 0 avisos e 0 erros; testes core 68, guitar 92, marbles 111, swing 188, web 390 e `node:test` 57; build do Vite |
| `yarn sdd:check`             | 2026-10-30 | PASS      | Catálogo, estados, gates, cobertura e links válidos                                                                                                                           |
| `yarn test:sdd`              | 2026-10-30 | PASS      | 109 testes                                                                                                                                                                    |
| `yarn docs:format:check`     | 2026-10-30 | PASS      | Todos os arquivos no estilo do Prettier                                                                                                                                       |
| `yarn test:gates`            | 2026-10-30 | PASS      | 231 testes                                                                                                                                                                    |
| `yarn security:dependencies` | 2026-10-30 | PASS      | Auditoria sem vulnerabilidades (info, baixa, moderada, alta e crítica em zero)                                                                                                |

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
- **Reexecuções:** `yarn check:all` rodou três vezes (depois do ajuste de CSS e do painel de depuração, e depois do rebase sobre a `main`, que trouxe a câmera pela cabeça e a escalada do Arranha-Teia); a última é a registrada. O rebase teve conflitos só de tabela em `README.md` e `specs/README.md`, resolvidos mantendo a versão da `main` e reaplicando as adições do violão (9 inserções, 0 remoções).

## Limitações e riscos residuais

| Limitação/risco                                                                                                        | Impacto                                                     | Responsável | Aceite             |
| ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ----------- | ------------------ |
| Nunca testado com mão real: a separação das pontas dos dedos e os falsos positivos de dedo são hipóteses (H-01 e H-02) | O reconhecimento pode errar dedos ou exigir ajuste do braço | maintainer  | pendente do Gate 3 |
| Sem profundidade (z), um dedo só passando sobre o braço pode contar como apertando                                     | Status "tire o dedo" para um dedo que o jogador não apertou | maintainer  | pendente do Gate 3 |
| Limiar da batida, refratário, permanência, suavização, atraso entre cordas e decaimento são palpites (H-03)            | Batidas perdidas ou duplas; som sem o timbre esperado       | maintainer  | pendente do Gate 3 |
| Latência fim a fim e quadros por segundo não medidos (H-04)                                                            | Pode haver atraso perceptível entre a batida e o som        | maintainer  | pendente do Gate 3 |
| O áudio só é liberado por um gesto do usuário; a batida pela mão sozinha não o libera                                  | Antes do primeiro clique ou tecla a batida pela mão não soa | maintainer  | pendente do Gate 3 |
| Gates 1 e 2 foram confirmados explicitamente pelo maintainer na retomada em 2026-11-08                                 | Desenvolvimento autorizado; aceite físico continua separado | maintainer  | pendente           |

## Gate 3 — Convergência validada

- **Veredito:** pendente
- **Aprovador:** pendente do maintainer (wezercarvalho)
- **Data:** pendente
- **Escopo aprovado:** pendente
- **Riscos aceitos:** pendente
- **Observações:** o agente não concede o Gate 3. O teste ao vivo com a câmera, a mão e o notebook do maintainer, usando a gaveta de depuração, decide o veredito (`aprovado`, `aprovado com risco aceito` ou `rejeitado`).

## Revisão após o primeiro teste ao vivo — 2026-10-30

### Resultado do teste do maintainer

- **REPROVADO para Gate 3:** braço com 40% da altura era grosso e impraticável; câmera dividida com a coluna lateral deixava pouco espaço; seleção prévia de acorde contrariava o fluxo desejado; batida por pico isolado precisava de leitura temporal melhor.
- **Ação:** revisão implementada na mesma PR #105. Gate 3 continua pendente de novo teste ao vivo.

### Evidência automatizada da revisão

| Verificação                    | Resultado                                                                                                   |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Pacote `@guess-my-move/guitar` | 82 testes passando, incluindo cinco formatos, dedilhado independente, permanência, troca e jitter de batida |
| Integração web direcionada     | 69 testes passando em tela, controlador, overlay, guia, diagrama e áudio                                    |
| Typecheck dos dois workspaces  | PASS                                                                                                        |
| `yarn lint`                    | PASS, 0 avisos e 0 erros em 193 arquivos                                                                    |

### Evidência visual da revisão

- Capturada no Browser panel via `playwright-cli`, em 1440 × 900, com fluxo de câmera sintético local e MediaPipe real.
- A câmera ocupa a largura útil; o braço usa 58% da largura e 18% da altura do vídeo; a zona de batida ocupa o restante à direita.
- Não há círculos nem números de um acorde alvo sobre o braço. As linhas, os painéis e os controles não estão cortados.
- Console: 0 erros; 1 aviso esperado do runtime do MediaPipe sobre verificação OpenGL desativada.
- Limite: o fluxo sintético prova layout e inicialização, não precisão com dedos reais nem qualidade rítmica. Essas duas validações seguem no Gate 3.

## Retomada e revisão integrada — 2026-11-08

O maintainer encerrou o standby do Violão e aprovou explicitamente os gates de desenvolvimento nesta sessão. A PR #105 continua sendo a entrega consolidada, em draft, com base na main `b9335d5`. SC-003 não é considerado executado por essa autorização.

### Correções verificadas

- Integração da main, resolvendo README, catálogo SDD, scripts web e configuração Vite sem remover proxy HTTP/Socket.IO nem regressões dos outros jogos.
- FR-015/NFR-001: `AsyncTrackerResource` invalida carregamento antigo ao parar/desmontar; reiniciar após erro permite nova carga e limpa o motivo anterior. `VideoFrameGate` substitui callbacks duplicados. Parar a câmera ou ficar sem quadros por 500 ms limpa mãos, dedos e acorde, exigindo nova permanência na retomada.
- FR-014: uma retomada antiga de áudio não acessa contexto descartado nem muda o estado de um novo contexto. O desbloqueio global usa `click`: no navegador, retirar o aviso no `pointerdown` deslocava o botão antes do primeiro clique terminar, e nenhuma corda era agendada. Depois da correção o primeiro clique agenda seis cordas.
- NFR-001/NFR-002: a biblioteca MediaPipe instalada tentou enviar duas requisições de telemetria para `odml.pa.googleapis.com/v1/log` durante o smoke inicial. A página agora declara `connect-src 'self'` antes dos módulos; o smoke final confirma duas violações bloqueadas, zero requisições externas concluídas e detector local operacional. Não foi feita afirmação sobre o conteúdo dos payloads tentados. A proteção é desta página; não representa auditoria de todas as páginas do repositório.
- FR-015/FR-016: a regra de três colunas dos painéis estava antes da regra básica e era sobrescrita; a ordem CSS foi corrigida. README, guia de jogos, arquitetura e issues #95/#99/#101–#104 foram reconciliados com CQ-007, sem seletor de acorde alvo.

### Evidência automatizada

Ambiente de validação completa: Linux, Node 26.12.1, Yarn 4.18.1, container isolado sem rede externa, instalação imutável usando cache e modelos locais previamente verificados. Não houve mudança de dependências publicadas.

| Comando                                                                        | Resultado                                                                                                                                                          |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `yarn check:all`                                                               | PASS: tipos, lint (zero avisos/erros), 68 core, 82 guitar, 174 marbles, 264 swing, 98 server, 603 web, 86 testes Node de scripts web; build de todos os workspaces |
| `yarn workspace @guess-my-move/web test:guitar`                                | PASS após as correções: 74 testes de tela/controlador/áudio/overlay/guia e 6 testes Node de privacidade                                                            |
| `yarn workspace @guess-my-move/web test`                                       | PASS no estado final: 603 testes Vitest e 87 testes Node, incluindo a regressão CSP                                                                                |
| `yarn check:static`                                                            | PASS novamente após o ajuste do primeiro clique                                                                                                                    |
| `yarn workspace @guess-my-move/web build`                                      | PASS no estado final, incluindo CSP                                                                                                                                |
| `yarn sdd:check`, `yarn docs:format:check`, `yarn test:sdd`, `yarn test:gates` | PASS: estrutura/documentação e 109 testes SDD + 241 dos gates                                                                                                      |
| `yarn security:dependencies`                                                   | PASS: zero ocorrências em todas as severidades                                                                                                                     |
| `yarn security:runtime`                                                        | PASS segundo releases publicadas; não atesta ausência de vulnerabilidades                                                                                          |

Os testes novos de carregamento, limpeza do acorde e reinício após erro falharam antes da correção (3 falhas), assim como a retomada de áudio após descarte (TypeError) e a presença da CSP no HTML. O teste de componente confirma que o aviso permanece durante `pointerdown` e que o clique agenda o som. Após as mudanças finais no hook/HTML, o suite web e build são executados novamente; os demais workspaces não tiveram alterações desde o `check:all`.

### Conferência de navegador

Chromium 156.0.8078.4, frontend compilado, câmera sintética nativa do Chromium, GPU por software, detector MediaPipe real e Web Audio real instrumentado somente pela contagem de fontes agendadas. Não há imagem de pessoa nem áudio gravado nos artefatos. Os [resultados numéricos](evidence/browser-smoke.json) registram:

- Menu abre o quarto jogo sem acorde antecipado; primeiro clique para baixo agenda seis fontes e o clique para cima mais seis. Isso verifica agendamento, não timbre percebido nem latência acústica.
- Câmera ativada, detector pronto, parada e reativação sem erro de página.
- Desktop 1440×1000: vídeo e overlay com o mesmo retângulo de 1270×760 e três colunas de painéis. Coordenadas negativas no JSON decorrem do scroll até a depuração, não de deslocamento entre vídeo e overlay.
- Tela 390×844: uma coluna e ausência de overflow horizontal.
- Zero erros JavaScript, zero conexões externas concluídas e duas tentativas da biblioteca bloqueadas por CSP.
- Inspeção visual de captura sintética: braço fino, seis cordas/cinco casas, zona de batida à direita, painéis abaixo da câmera, indicador de câmera e privacidade visíveis. A captura sintética usada na inspeção fica apenas no ambiente de trabalho; o artefato versionado contém somente números de layout e contagem de eventos.

O build mantém o aviso já existente de chunk grande do Arranha-Teia; não é erro nem medição de fluidez. Avisos de canvas sem implementação no jsdom também não são prova de renderização; a conferência Chromium cobre o caminho real.

### Pendências e entrega

- O maintainer ainda precisa repetir o teste com câmera e mãos reais: cinco acordes, troca entre eles, batidas nos dois sentidos, mão direita/esquerda, iluminação e ajustes. Registrar em SC-003 o que funcionou e os limites; não foi medida precisão, latência ou FPS de uso real.
- A PR permanece em draft para revisão. O `pr-gate` remoto não roda em rascunho; será executado quando o maintainer marcar ready. Não houve merge, deploy nem fechamento de #95.
