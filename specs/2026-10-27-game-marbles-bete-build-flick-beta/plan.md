# Plano — 2026-10-27-game-marbles-bete-build-flick-beta

## Resumo técnico

A lógica nova do estalo fica no pacote puro `@guess-my-move/marbles`, em um módulo `flick.ts` que compõe o detector de pinça existente: `handDirection(landmarks, aspect)` dá a orientação da mão (espelhada e normalizada); `createFlickDetector(config)` guarda um histórico curto de amostras (400 ms) e emite `FlickReading = PinchReading & { direction; release }`, com `closed` significando armado, e emite a soltura (rápido/lento, pico de velocidade de abertura, duração da subida e direção no início da abertura) ao cruzar a abertura; `flickShot(release, config)` mapeia a velocidade de abertura para a força do tiro ou devolve `null`. A rodada (`round.ts`) ganha `observeFlick(reading, nowMs)` e `snapshot().flick`, e `fire` passa a receber a velocidade. No app web, o `MarblesController` ganha `mode`/`setMode(mode)`, roteia cada quadro para o detector do modo e expõe `mode` e o debug do estalo no snapshot; `fieldView.drawField` desenha a seta de direção; `MarblesScreen` ganha o seletor "Modo de tiro" e as mensagens; o painel de depuração mostra as linhas do estalo. O modo pinça, seus testes, a física, o campo, o alvo e o jogo de cartas não mudam.

## Contexto técnico

- **Runtime/versões:** Node 24 na VPS do agente (o `engines` do repositório exige >=26.12.1; os scripts de documentação e SDD rodam no Node 24), Yarn 4.18.1 via Corepack, TypeScript 7.0.2, React 19.3.1, Vite 8.3.4, Vitest 5.0.5.
- **Dependências:** nenhuma nova. `flick.ts` é lógica pura; o app web reusa `@mediapipe/tasks-vision` já presente.
- **Provedores externos:** nenhum. Nenhuma imagem sai do navegador.
- **Persistência:** nenhuma.
- **Testes:** Vitest em `packages/marbles` e `apps/web`; scripts oficiais `yarn typecheck`, `yarn lint`, `yarn test`, `yarn build`, `yarn check:all`, `yarn sdd:check`, `yarn test:sdd`, `yarn docs:format:check`, `yarn test:gates`, `yarn security:dependencies`.
- **Restrições:** privacidade (sem rede para imagens), pureza da lógica em Node, isolamento do modo pinça e do jogo de cartas, Chrome desktop, honestidade de evidência (sem afirmar desempenho ou viabilidade do estalo sem medição).

## Constitution Check — pré-design

| Princípio/gate                              | Resultado | Evidência ou exceção                                                                                                       |
| ------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------- |
| I. Intenção antes da implementação          | PASS      | Gates 1 e 2 registrados antes do código; descobertas futuras atualizam `spec.md` primeiro.                                 |
| II. Uma fonte vigente                       | PASS      | `spec.md` é a única fonte comportamental; esta spec estende a do modo pinça sem substituí-la.                              |
| III. Rastreabilidade                        | PASS      | Cada FR tem tarefa formal em `tasks.md` e linha na matriz de requisitos.                                                   |
| IV. Test-first e incremental                | PASS      | Cada tarefa comportamental começa por teste falhando; o detector de estalo compõe o de pinça atrás da interface existente. |
| V. Evidência honesta                        | PASS      | NFR-002 e H-01 a H-04 limitam afirmações; os números do estalo são placeholders e a viabilidade é decisão do maintainer.   |
| VI. Fronteira, privacidade e segredos       | PASS      | Sem rede para imagem (FR-008); sem chaves; o estalo não introduz novo dado sensível.                                       |
| VII. Neutralidade e contexto sob demanda    | PASS      | Nenhuma dependência de provedor de agente; contexto técnico atualizado em `docs/`.                                         |
| VIII. Clareza, preservação, operação segura | PASS      | UTF-8 e acentuação; o modo pinça, seus testes e arquivos fora do escopo são preservados.                                   |

## Pesquisa e decisões

- `research.md` — estalo como pinça que abre rápido (composição do detector de pinça); direção pela orientação da mão medida no início da abertura; rápido vs. lento por início da subida, duração e pico de velocidade; força por velocidade de abertura; roteamento por modo no controlador.

## Estrutura afetada

```text
packages/marbles/
  src/
    flick.ts                              NOVO: handDirection, createFlickDetector, flickShot, DEFAULT_FLICK
    round.ts                              observeFlick, snapshot().flick, fire recebe velocidade
    index.ts                              exportar a API do estalo
    pinch.ts, physics.ts, shot.ts         reusados, NÃO alterados em comportamento
  test/
    flick.test.ts                         NOVO: handDirection, detector de estalo, flickShot
    round.test.ts                         casos novos de observeFlick (não altera os do modo pinça)
apps/web/
  src/marbles/
    controller.ts                         mode, setMode, roteamento por modo, debug do estalo no snapshot
    fieldView.ts / desenho do campo       drawField desenha a seta de direção do estalo
    MarblesScreen.tsx                     seletor "Modo de tiro", mensagens do estalo, aria-live
    DebugPanel.tsx                        linhas do estalo (armado, razão, velocidade, duração, resultado)
  src/card/, src/round/ do jogo de cartas  NÃO alterados
docs/product/PROJECT_SPEC.md, README.md, docs/development-context/, guia de arquitetura   atualizar
specs/2026-10-27-game-marbles-bete-build-flick-beta/                                        esta spec
specs/README.md                                                                             nova linha no catálogo
```

## Design

### Componentes e responsabilidades

- **`handDirection`** (pacote): a partir dos landmarks e da proporção, devolve `Vec | null` com a orientação da mão (pulso→base do médio, x corrigido e espelhado, normalizado); `null` se degenerada.
- **`createFlickDetector`** (pacote): compõe `createPinchDetector`; a cada leitura guarda `{ ratio, t }` num histórico de 400 ms e devolve `FlickReading` com `closed` = armado, `direction` corrente e `release` quando a razão cruza a abertura; a soltura traz `fast`, `openingSpeed` (pico), `riseMs` (duração) e `direction` (do início da abertura). Perda da mão zera o estado.
- **`flickShot`** (pacote): de uma soltura, devolve `{ velocity, power } | null`; `null` para soltura lenta ou abaixo da força mínima; caso contrário, interpola a velocidade de 300 a 1100 unid/s para 2–8 razão/s.
- **`round`** (pacote): `observeFlick(reading, nowMs)` arma ao fechar depois de vista aberta, publica a direção de pré-visualização, dispara no estalo rápido chamando `fire(direction, velocity)`, cancela no lento, no fraco e na perda > 300 ms; `snapshot().flick` expõe `{ direction } | null`.
- **`controller`/tela** (web): `mode`/`setMode` reiniciam a rodada e trocam o detector; o laço de quadros roteia para `observePinch` ou `observeFlick`; a tela mostra o seletor, as mensagens por estado, a seta de direção no campo e o painel do estalo.

### Contratos e dados

- `Vec = { x: number; y: number }` (orientação normalizada).
- `FlickRelease = { fast: boolean; openingSpeed: number; riseMs: number; direction: Vec | null }`.
- `FlickReading = PinchReading & { direction: Vec | null; release: FlickRelease | null }` (`closed` = armado).
- `FlickShot = { velocity: number; power: number }`; `flickShot` devolve `FlickShot | null`.
- `DEFAULT_FLICK`: histerese herdada (0,35/0,55), RISE_START 0,40, histórico 400 ms, duração <= 300 ms, velocidade >= 2 razão/s, mapeamento 2–8 → 300–1100, perda 300 ms.
- `snapshot()` do controlador passa a expor `mode` e, no modo estalo, `flick` e as linhas de depuração.

### Fluxo

1. O modo inicial vem de `?mode=estalo` (ou pinça por padrão); trocar de modo reinicia a rodada e os detectores.
2. No modo estalo, a pinça que fecha depois de vista aberta arma; a tela mostra a seta de direção a partir da bolinha de tiro.
3. Ao abrir, o detector mede a subida (início = última amostra <= 0,40; duração até cruzar 0,55; pico de velocidade) e emite a soltura; `flickShot` decide a força.
4. Estalo rápido e forte dispara (`fire` com a velocidade); a física avança como no modo pinça; o primeiro contato leva a `hit`.
5. Estalo lento, fraco ou perda da mão > 300 ms cancela; qualquer perda zera o armado. O painel registra o resultado do último estalo.

## Mapeamento de requisitos

| Requisito | Abordagem                                                                  | Evidência planejada                            |
| --------- | -------------------------------------------------------------------------- | ---------------------------------------------- |
| FR-001    | `createFlickDetector` compondo a pinça, histórico, soltura rápido/lento    | `flick.test.ts`                                |
| FR-002    | `handDirection` pulso→base do médio, x corrigido e espelhado, normalizado  | `flick.test.ts`                                |
| FR-003    | `flickShot` com mapeamento linear 2–8 → 300–1100 e `null` para lento/fraco | `flick.test.ts`                                |
| FR-004    | `observeFlick` e `snapshot().flick` na rodada; `fire` recebe a velocidade  | `round.test.ts`                                |
| FR-005    | Seletor "Modo de tiro"; `mode`/`setMode`; roteamento; `?mode=estalo`       | testes do controlador e da tela                |
| FR-006    | Seta no campo, rótulo alpha, mensagens por estado e `aria-live`            | `MarblesScreen.test.tsx`                       |
| FR-007    | Painel do estalo: armado, razão, velocidade, duração, resultado            | `DebugPanel.test.tsx`                          |
| FR-008    | Sem rede para imagem no modo estalo; aviso de privacidade                  | busca no código e inspeção de rede no Chromium |
| FR-009    | Modo pinça e jogo de cartas sem mudança de comportamento                   | testes existentes verdes, sem alteração        |
| FR-010    | Atualização de README, guia de arquitetura, PROJECT_SPEC e catálogo        | `yarn docs:format:check`, `yarn sdd:check`     |

## Estratégia test-first

1. Escrever os testes de `handDirection` e do detector de estalo e confirmar a falha esperada;
2. implementar `flick.ts` (direção e detector) e confirmar verde;
3. escrever os testes de `flickShot`, implementar e confirmar verde;
4. escrever os testes de `observeFlick` e do snapshot, implementar na rodada e exportar em `index.ts`;
5. no `apps/web`, escrever os testes do controlador (modo, roteamento, troca reinicia, debug) e da tela (seletor, mensagens, seta, linhas de depuração), e implementar;
6. verificar privacidade por busca no código e inspeção de rede no Chromium; confirmar os testes do modo pinça e do jogo de cartas sem alteração;
7. executar os gates oficiais e registrar a validação.

## Riscos, rollout e rollback

| Risco                                                  | Mitigação                                                          | Rollback/contingência                      |
| ------------------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------ |
| Abrir devagar sem querer cancela o tiro                | Limiar de velocidade exposto no painel; mensagem "lento demais"    | Ajustar duração/velocidade mínimas         |
| Falso disparo ao relaxar a mão                         | Exige estalo rápido E forte; `flickShot` devolve `null` para fraco | Elevar a velocidade mínima                 |
| Direção instável ao fechar a pinça                     | Direção medida no início da abertura; `null` quando degenerada     | Usar última direção válida; ajustar a H-02 |
| Perda da mão no estalo perde a medição                 | Histórico de 400 ms; qualquer perda zera o armado                  | Aumentar a janela do histórico             |
| Poucas amostras por estalo numa webcam de 30 quadros/s | Pico de velocidade em vez de média; lacuna declarada até a medição | Registrar a lacuna na validação (H-04)     |

## Constitution Check — pós-design

| Princípio/gate                              | Resultado | Evidência ou exceção                                                                          |
| ------------------------------------------- | --------- | --------------------------------------------------------------------------------------------- |
| I. Intenção antes da implementação          | PASS      | O design não introduz comportamento fora de `spec.md`.                                        |
| II. Uma fonte vigente                       | PASS      | O plano referencia IDs; não duplica regras da spec.                                           |
| III. Rastreabilidade                        | PASS      | Matriz de requisitos acima e cobertura em `tasks.md`.                                         |
| IV. Test-first e incremental                | PASS      | Estratégia test-first; lógica pura testável; detector de estalo compõe o de pinça.            |
| V. Evidência honesta                        | PASS      | Nenhum desempenho ou viabilidade afirmado; números são placeholders e a #68 é decisão humana. |
| VI. Fronteira, privacidade e segredos       | PASS      | Processamento local; sem imagem em rede, log ou disco.                                        |
| VII. Neutralidade e contexto sob demanda    | PASS      | Sem regra específica de provedor de agente.                                                   |
| VIII. Clareza, preservação, operação segura | PASS      | UTF-8 e acentuação; modo pinça, seus testes e arquivos fora do escopo preservados.            |

## Complexidade e desvios

| Necessidade   | Impacto | Alternativa mais simples rejeitada | Aprovação |
| ------------- | ------- | ---------------------------------- | --------- |
| Nenhum desvio | —       | —                                  | —         |
