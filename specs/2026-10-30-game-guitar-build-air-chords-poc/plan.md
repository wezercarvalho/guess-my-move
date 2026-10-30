# Plano — 2026-10-30-game-guitar-build-air-chords-poc

## Resumo técnico

Um pacote puro `@guess-my-move/guitar` concentra a teoria (afinação, acordes, geometria do braço), o reconhecimento (papéis das mãos, dedos em corda e casa, conferência do acorde, detector de batida) e a síntese de corda. Toda a lógica recebe o tempo por parâmetro e os testes usam landmarks sintéticos. O app `apps/web` acrescenta a página `guitar.html`, um controlador por quadro no padrão do Arranha-Teia (câmera, rastreador de duas mãos, desenho do braço, ligação dos módulos), o tocador Web Audio e a interface (status, escolha, diagrama, guia, depuração). O menu ganha um card com selo Alpha. Sem dependência nova de execução.

## Contexto técnico

- **Runtime/versões:** Node 26.12.1, Yarn 4.18.1, TypeScript 7.0.2, Vitest 5.0.5, Vite 8.3.4, React (já no `apps/web`), `@mediapipe/tasks-vision` (já usado).
- **Dependências:** nenhuma nova. O pacote novo depende só do TypeScript e do Vitest como os demais.
- **Provedores externos:** nenhum. Áudio sintetizado localmente; modelos do MediaPipe já servidos pelo app.
- **Persistência:** nenhuma.
- **Testes:** `yarn workspace @guess-my-move/guitar test`, `yarn workspace @guess-my-move/web test`, agregados `yarn check:all`, `yarn sdd:check`, `yarn docs:format:check`, `yarn test:gates`.
- **Restrições:** privacidade da câmera (NFR-001); sem rede de terceiros (NFR-002); sem afirmação de precisão (NFR-003); tempo injetado (NFR-004).

## Constitution Check — pré-design

| Princípio/gate                              | Resultado | Evidência ou exceção                                                                                                                 |
| ------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| I. Intenção antes da implementação          | PASS      | Gates 1 e 2 aprovados antes do código (antecipados, ver `clarification.md` e `tasks.md`); CQ-001 a CQ-006 resolvidas antes do plano. |
| II. Uma fonte vigente                       | PASS      | `spec.md` é a fonte do comportamento; o plano referencia IDs e não repete regras de outras specs.                                    |
| III. Rastreabilidade                        | PASS      | Matriz de requisitos abaixo e tarefa formal em `tasks.md` para cada FR.                                                              |
| IV. Test-first e incremental                | PASS      | Cada módulo começa por teste que falha; incrementos pequenos e reversíveis.                                                          |
| V. Evidência honesta                        | PASS      | NFR-003 e H-01 a H-04: os parâmetros são hipóteses; nada é afirmado sobre precisão, latência ou fps; limitações declaradas.          |
| VI. Fronteira, privacidade e segredos       | PASS      | Sem frames fora do navegador (NFR-001); sem chaves; nenhum dado de câmera persistido; a fronteira carta x adivinhador não se aplica. |
| VII. Neutralidade e contexto sob demanda    | PASS      | Sem regra de provedor de agente.                                                                                                     |
| VIII. Clareza, preservação, operação segura | PASS      | UTF-8 e acentuação; os três jogos existentes e o design system só são tocados pelo card do menu e pelo selo.                         |

## Pesquisa e decisões

- `research.md` — estado da arte, limites do MediaPipe, áudio e acordes, com confiança por afirmação e alternativas rejeitadas.

## Estrutura afetada

```text
packages/guitar/                    (novo, puro)
  package.json tsconfig*.json vitest.config.ts
  src/index.ts                      contrato público
  src/theory.ts                     afinação, tipos, notas
  src/chords.ts                     5 acordes e ordem de ensino
  src/board.ts                      casas, cordas, células, posicionamento
  src/oneEuro.ts                    filtro One Euro
  src/hands.ts                      papéis das mãos
  src/fingers.ts                    dedos em corda e casa
  src/evaluate.ts                   conferência, correção, estabilidade
  src/strum.ts                      detector de batida
  src/synth.ts                      Karplus-Strong
  src/strumPlan.ts                  plano da batida
  test/*.test.ts
apps/web/
  guitar.html  vite.config.ts  scripts/pages.test.mjs
  src/design/Badge.tsx (+ teste, + design.css)
  src/home/HomePage.tsx (+ teste)
  src/guitar/
    main.tsx GuitarScreen.tsx guitar.css
    guitarController.ts useGuitarGame.ts boardOverlay.ts
    audioPlayer.ts ChordDiagram.tsx guide.ts GuitarDebugPanel.tsx
    *.test.ts(x)
docs/development-context/architecture/architecture-guide.md   (seção do jogo)
specs/README.md                      (catálogo)
README.md                            (lista de jogos)
```

## Design

### Componentes e responsabilidades

| Componente                          | Entrada                                                  | Saída                                                        | Falhas e limites                                                  |
| ----------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------- |
| `theory`/`chords`                   | nada (dados)                                             | afinação MIDI, `Chord[]` na ordem de ensino, notas por corda | Dados validados por teste de tríade.                              |
| `board`                             | posição de tela normalizada, `BoardPlacement`, canhoto   | `{ string, fret } \| null`; posição das casas                | Fora do braço devolve `null`; casa 0 e além da casa 5 não contam. |
| `hands`                             | mãos do quadro (landmarks, sem rótulo), `BoardPlacement` | `{ fretting, strumming }` por lado da tela                   | Uma mão: compara com a divisa e mantém o papel dentro da margem.  |
| `fingers`                           | `fretting` do quadro, tempo                              | `FingerPress[]` estáveis                                     | Mão some: mantém por `graceMs`, depois zera.                      |
| `recognizeChord`/`ChordRecognition` | `FingerPress[]`, tempo                                   | `ChordId \| null` confirmado                                 | Forma parcial ou extra não recebe nome; tolera falhas curtas.     |
| `evaluate`                          | acorde reconhecido, `FingerPress[]`                      | cordas soando para o plano de áudio                          | Usado somente depois do reconhecimento.                           |
| `strum`                             | amostra `{tMs, x, y, handSize}`, zona                    | `StrumEvent \| null`                                         | Reinicia em lacuna ou perda; ignora os primeiros quadros.         |
| `synth`/`strumPlan`                 | MIDI, taxa de amostragem, semente; cordas soando, batida | `Float32Array`; lista de notas com atraso e ganho            | Determinístico por semente.                                       |
| `audioPlayer` (web)                 | plano da batida                                          | som agendado no `AudioContext`; estado `locked/running`      | Um único contexto, criado no gesto; falha de áudio vira aviso.    |
| `guitarController` (web)            | vídeo, rastreador, teclado, tempo                        | `GuitarSnapshot` assinado pela tela                          | Rastreador que falha vira estado `error` com motivo.              |

### Contratos e dados

- Cordas numeradas como no violão: **6 é a mais grave** e 1 a mais aguda. Vetores internos ficam na ordem 6 a 1 (`STRING_NUMBERS`).
- `StringSpec`: `{ kind: 'muted' } | { kind: 'open' } | { kind: 'fret', fret: 1..5, finger: 1..4 }`.
- `FingerPress`: `{ finger: 1..4, string: StringNumber, fret: 1..5 }`.
- `ChordRecognition`: recebe `FingerPress[]` e devolve `ChordId | null` após permanência e tolerância temporal.
- Coordenadas de tela normalizadas de 0 a 1 **no espaço espelhado** (o que o jogador vê); o controlador converte o x do landmark por `1 - x`. A razão de aspecto do vídeo só entra no cálculo do tamanho da mão.
- `BoardPlacement`: `{ x, y, width, height }` (tela normalizada) e opção `leftHanded`.
- Parâmetros em constantes nomeadas e exportadas (`DEFAULT_*`), todos hipóteses a calibrar:

| Parâmetro                     | Valor inicial                       | Justificativa                                                                        | Como medir depois                  |
| ----------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------- |
| One Euro dos dedos            | 1,5 Hz, beta 0,8, dcutoff 1,0       | acompanha trocas de posição mais rápido sem abandonar a suavização em repouso        | gaveta: tremor e atraso da ponta   |
| One Euro da palma             | 2,0 Hz, beta 0,5, dcutoff 2,0       | menos atraso em movimento rápido; a velocidade já vem em tamanhos de mão por segundo | gaveta: velocidade da batida       |
| Permanência do dedo           | 100 ms                              | faixa de 80 a 120 ms da pesquisa                                                     | tempo até o dedo "pegar" ao vivo   |
| Margem de saída da célula     | 25% da célula                       | evita alternar na fronteira                                                          | falsos "soltou" ao vivo            |
| Tolerância de mão perdida     | 150 ms                              | cerca de 4 quadros a 30 fps                                                          | piscadas do status                 |
| Margem da divisa das mãos     | 0,03                                | evita trocar o papel de uma mão parada na divisa                                     | troca de papel ao vivo             |
| Forma reconhecida sustentada  | 100 ms                              | soma-se à permanência de 100 ms da célula e evita reconhecer passagem                | tempo até o nome aparecer          |
| Tolerância sem forma válida   | 250 ms                              | mantém o nome durante poucos quadros ruins                                           | piscadas do resultado              |
| Batida: limiar liga / desliga | 3 / 1,5 tamanhos de mão por segundo | mão parada deriva abaixo de 1; batida suave passa de 3                               | velocidade registrada na gaveta    |
| Batida: deslocamento mínimo   | 0,55 tamanho de mão                 | rejeita pico curto de jitter e preserva uma travessia intencional                    | batidas perdidas ou fantasmas      |
| Batida: força máxima          | 12 tamanhos de mão por segundo      | batida vigorosa                                                                      | idem                               |
| Refratário da batida          | 150 ms                              | comporta 4 golpes por segundo (pesquisa)                                             | batidas perdidas ou duplas ao vivo |
| Atraso entre cordas           | 18 ms                               | faixa de 15 a 25 ms                                                                  | ouvido do maintainer               |
| Decaimento da corda           | 2,5 s (queda de 60 dB)              | soa como corda de aço aberta                                                         | ouvido do maintainer               |

### Fluxo

1. A cada quadro o controlador pede ao rastreador as mãos, converte o x para o espaço espelhado e chama `hands` para separar mão do braço e mão da batida.
2. `fingers` transforma as pontas da mão do braço em `FingerPress[]` estáveis; `recognizeChord` compara a assinatura corda+casa com os cinco formatos e `ChordRecognition` aplica permanência e tolerância.
3. `strum` acumula uma trajetória vertical da palma da outra mão; ao atingir velocidade e deslocamento mínimos, aciona `strumPlan` com o acorde confirmado e o `audioPlayer` agenda as notas.
4. O teclado e o clique testam o último acorde reconhecido; antes do primeiro reconhecimento, usam Em.
5. Caminhos de erro: rastreador indisponível mostra o motivo; câmera negada mostra a mensagem e mantém o teste de som; áudio bloqueado mostra o aviso até o primeiro gesto.

## Mapeamento de requisitos

| Requisito        | Abordagem                                                   | Evidência planejada                                                 |
| ---------------- | ----------------------------------------------------------- | ------------------------------------------------------------------- |
| FR-001 a FR-003  | Card com `Badge`, `guitar.html`, entrada do Vite            | `HomePage.test.tsx`, `Badge` teste, `pages.test.mjs`                |
| FR-004, FR-005   | `theory`, `chords`, `board`                                 | Testes de tríade, de casas e de células                             |
| FR-006, FR-007   | `hands`, `oneEuro`, `fingers`                               | Testes com landmarks sintéticos, rótulo certo, trocado e ausente    |
| FR-008 a FR-010  | `recognizeChord` e `ChordRecognition`                       | Cinco formas, dedo independente, formato extra, permanência e troca |
| FR-011           | `strum`                                                     | Testes de trajetória (escala, limiar, refratário, salto)            |
| FR-012, FR-013   | `synth` e `strumPlan`                                       | Fundamental a 1%, decaimento, determinismo, ordem e ganho           |
| FR-014           | `audioPlayer`                                               | `AudioContext` simulado: bloqueado, desbloqueio, agendamento        |
| FR-015, FR-016   | `GuitarScreen`, `guitarController`, `ChordDiagram`, `guide` | Teste de fumaça com rastreador falso e testes de componente         |
| FR-017           | Ajuste, `GuitarDebugPanel`, teclado e clique                | Testes de componente e do controlador                               |
| NFR-001, NFR-002 | Sem `fetch`/rede no módulo; sem arquivo de áudio            | Teste de varredura de imports e de recursos                         |

## Estratégia test-first

1. Escrever o teste do módulo e vê-lo falhar por ausência do módulo ou do comportamento;
2. implementar o mínimo para passar;
3. confirmar o teste direcionado passando;
4. integrar no controlador e na tela;
5. demonstrar com o teste de fumaça e a captura de tela no Chromium;
6. refatorar mantendo os testes verdes.

## Riscos, rollout e rollback

| Risco                                       | Mitigação                                                                      | Rollback/contingência                          |
| ------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------- |
| Falsos positivos de dedo sem z              | Permanência por célula, confirmação da forma, tolerância e gaveta de depuração | Calibrar os parâmetros no teste ao vivo        |
| Braço fora do alcance da mão de cada pessoa | Ajuste de posição e tamanho                                                    | Parâmetros de colocação em constantes          |
| Batida perdida ou duplicada                 | Histerese, refratário, depuração da velocidade, teclado como alternativa       | Ajustar limiares                               |
| Latência perceptível                        | Mostrada na depuração (`baseLatency`/`outputLatency`)                          | Documentar como limite alpha                   |
| Jogo novo quebra os existentes              | Mudanças só aditivas; testes dos três jogos continuam                          | Reverter a PR (jogo isolado em pacote e pasta) |

## Constitution Check — pós-design

| Princípio/gate                              | Resultado | Evidência ou exceção                                                                      |
| ------------------------------------------- | --------- | ----------------------------------------------------------------------------------------- |
| I. Intenção antes da implementação          | PASS      | O design não adiciona comportamento fora de `spec.md`.                                    |
| II. Uma fonte vigente                       | PASS      | Plano referencia IDs; valores de parâmetro vivem em constantes citadas aqui, não na spec. |
| III. Rastreabilidade                        | PASS      | Matriz acima e cobertura por tarefa formal.                                               |
| IV. Test-first e incremental                | PASS      | Estratégia test-first por módulo; pacote isolado e reversível.                            |
| V. Evidência honesta                        | PASS      | Parâmetros declarados como hipóteses; nenhuma precisão ou latência afirmada.              |
| VI. Fronteira, privacidade e segredos       | PASS      | Nenhuma rede; nenhum quadro persistido; sem chave de provedor.                            |
| VII. Neutralidade e contexto sob demanda    | PASS      | Contexto técnico atualizado em `docs/` na fase final.                                     |
| VIII. Clareza, preservação, operação segura | PASS      | Código dos três jogos preservado; UTF-8 e acentuação.                                     |

## Complexidade e desvios

| Necessidade   | Impacto | Alternativa mais simples rejeitada | Aprovação |
| ------------- | ------- | ---------------------------------- | --------- |
| Nenhum desvio | —       | —                                  | —         |
