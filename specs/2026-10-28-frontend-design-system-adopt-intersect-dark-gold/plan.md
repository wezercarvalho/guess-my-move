# Plano — 2026-10-28-frontend-design-system-adopt-intersect-dark-gold

## Resumo técnico

Um design system pequeno é adicionado em `apps/web/src/design/`: tokens CSS em `tokens.css` (cores, tipografia, escala de espaçamento de 4px, raio zero, movimento e foco), `fonts.css` com `@font-face` de DM Sans e Space Grotesk servidas por arquivos woff2 versionados ao lado (`./fonts/dm-sans-latin.woff2` e `./fonts/space-grotesk-latin.woff2`, com aviso OFL), e `design.css` com as classes dos componentes. Os componentes base React (`Button`, `Panel`, `Eyebrow`, `Notice`, `Steps`, `SegmentedControl`, `DrawerToggle`, `DrawerPanel` e o hook `useDrawer`) saem de um `index.ts` com testes ao lado de cada um. O `apps/web/src/styles.css` passa a importar os três CSS novos e a redirecionar as variáveis antigas `--cor-*` e `--raio` para os tokens, de modo que o menu inicial e o jogo de cartas herdam só paleta e fontes (CQ-002), sem mudar layout nem comportamento. A tela das bolinhas (`apps/web/src/marbles`) é refeita: cabeçalho com a marca em texto INTERSECT LOGIC e o título; layout em duas colunas em tela larga (campo ocupando a maior parte da largura, coluna estreita à direita com câmera pequena, contador, status, guia e ações) que vira uma coluna em tela média e estreita; seletor de modo como `SegmentedControl`; botão "Depuração" na barra do campo que abre a gaveta (`DrawerPanel`, recolhida por padrão, estado sem persistir, CQ-003/CQ-005); aviso de privacidade como `Notice`; a versão compacta do `CameraPanel` é só CSS num contêiner da tela, sem mudar o componente. A verificação é por testes de componente, por um teste em Node `apps/web/scripts/design-tokens.test.mjs` (variáveis exigidas, nenhum `url()` http/https, `@font-face` apontando para arquivos existentes, contrastes pela fórmula da WCAG: texto 4,5:1, borda e foco 3:1) e pela inspeção visual em Chromium headless nas larguras 1440, 900 e 390, registrada como TEXTO em `validation.md`. O comportamento de jogo das bolinhas e do jogo de cartas e seus testes de lógica não mudam. Esta spec documental cobre CQs resolvidas, plano, tarefas e checklists; o código foi implementado depois, e o Gate 3 foi concedido pelo merge (veja validation.md).

## Contexto técnico

- **Runtime/versões:** Node 24 na VPS do agente para os scripts de documentação e SDD (o `engines` do repositório pede >=26.12.1 <27); Yarn 4.18.1 via Corepack; TypeScript 7.0.2; React 19 e Vite no `apps/web`; Vitest para os testes de componente; Node `--test` para o teste de tokens.
- **Dependências:** nenhuma nova. As fontes são arquivos woff2 versionados (sem pacote npm nem CDN); os componentes são React puro com CSS próprio.
- **Provedores externos:** nenhum. Nenhuma requisição sai para terceiros, inclusive para fontes (NFR-004).
- **Persistência:** nenhuma. A gaveta de depuração não persiste o estado aberto (CQ-005).
- **Testes:** Vitest em `apps/web`; o teste de tokens roda em Node (`apps/web/scripts/design-tokens.test.mjs`); scripts oficiais `yarn typecheck`, `yarn lint`, `yarn test`, `yarn build`, `yarn check:all`, `yarn sdd:check`, `yarn test:sdd`, `yarn docs:format:check`, `yarn test:gates`, `yarn security:dependencies`.
- **Restrições:** privacidade (sem rede para imagem e para fontes), preservação do layout e do comportamento do menu e do jogo de cartas e dos testes de lógica das bolinhas, Chrome/Chromium desktop como alvo de verificação, honestidade de evidência (sem afirmar acessibilidade comprovada, desempenho ou aparência final sem medição), e contraste medido pela fórmula da WCAG para todo par de cor de texto.

## Constitution Check — pré-design

| Princípio/gate                              | Resultado | Evidência ou exceção                                                                                                                                             |
| ------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Intenção antes da implementação          | PASS      | Gates 1 e 2 aprovados antes do código; CQ-001 a CQ-006 resolvidas em `clarification.md` antes de `plan.md` e `tasks.md`.                                         |
| II. Uma fonte vigente                       | PASS      | `spec.md` é a única fonte vigente desta entrega; o plano referencia IDs e não duplica comportamento de outras specs.                                             |
| III. Rastreabilidade                        | PASS      | Cada FR tem linha na matriz de requisitos abaixo e tarefa formal em `tasks.md`.                                                                                  |
| IV. Test-first e incremental                | PASS      | Estratégia test-first por fase; teste de tokens e testes de componente antes da implementação; mudanças pequenas e reversíveis.                                  |
| V. Evidência honesta                        | PASS      | NFR-006 e H-01 a H-04 limitam afirmações; os contrastes são medidos pela fórmula da WCAG; as licenças OFL e a aparência ao vivo ficam declaradas como pendentes. |
| VI. Fronteira, privacidade e segredos       | PASS      | Sem rede para imagem e para fontes (FR-002, NFR-004); sem chaves; nenhum dado sensível novo.                                                                     |
| VII. Neutralidade e contexto sob demanda    | PASS      | Nenhuma dependência de provedor de agente; a referência de design é o site do próprio maintainer, declarada na spec.                                             |
| VIII. Clareza, preservação, operação segura | PASS      | UTF-8 e acentuação; o menu, o jogo de cartas e os testes de lógica das bolinhas são preservados; só apresentação e layout mudam.                                 |

## Pesquisa e decisões

- `research.md` — tokens lidos do CSS publicado do site da referência (cores, tipografia, forma, movimento, fontes com SHA-256); a tabela de contrastes medida pela fórmula da WCAG sobre os três fundos escuros (tinta #090909, superfície #121212, superfície elevada #1a1a1a); o token de borda de controle FIXADO em #77756d (4,31 / 4,06 / 3,77, todos >= 3:1), fechando a H-04; o mapa das variáveis antigas `--cor-*`/`--raio` para os tokens novos; e o campo para o resultado da leitura das licenças OFL, a preencher na implementação.

## Estrutura afetada

```text
apps/web/
  src/design/
    tokens.css            variáveis CSS: --ink #090909, --surface #121212, --surface-raised #1a1a1a, --paper #f6f4ef, --paper-text-muted #686760, --gold #c99400, --gold-bright #e0aa08, --gold-hover #f1c52d, --muted #aaa8a0, --line #292929 (decorativa), --control-border #77756d, --success #2ecc71, --danger #ff6b6b; foco outline 2px --gold-bright offset 5px; raio 0; movimento 0.2s e elevação -3px; famílias Space Grotesk (títulos, marca, eyebrow) e DM Sans (corpo) com fallback de sistema; escala de 4px; tamanhos fluidos com clamp
    fonts.css             @font-face de DM Sans e Space Grotesk (woff2 variável 400 a 700, subset latin, font-display swap) apontando para ./fonts/dm-sans-latin.woff2 e ./fonts/space-grotesk-latin.woff2
    fonts/dm-sans-latin.woff2          versionado, SHA-256 9fea608a947e67020c33cad9a6fe3d60c54119dfb8cff87768a8117a15ed7543
    fonts/space-grotesk-latin.woff2    versionado, SHA-256 0640890476fc1198ab4de571fb658de443c4d85b66466ec09534a8737ab1ce9d
    fonts/OFL.txt (aviso de licença)   aviso OFL ao lado dos binários
    design.css            classes dos componentes
    Button.tsx / Button.test.tsx       variantes primary, secondary, text
    Panel.tsx / Panel.test.tsx
    Eyebrow.tsx / Eyebrow.test.tsx
    Notice.tsx / Notice.test.tsx
    Steps.tsx / Steps.test.tsx         lista ordenada, etapa atual por aria-current
    SegmentedControl.tsx / SegmentedControl.test.tsx   fieldset com legenda e radios acessíveis
    Drawer.tsx / Drawer.test.tsx, useDrawer.ts         DrawerToggle (botão com aria-expanded e aria-controls) e DrawerPanel (recolhido por padrão e fora da árvore acessível quando fechado); useDrawer guarda o estado, sem persistência
    index.ts              API exportada dos componentes
  scripts/design-tokens.test.mjs       teste em Node: variáveis exigidas; nenhum url() http/https em tokens.css, fonts.css, design.css; @font-face aponta para arquivos existentes; contrastes pela fórmula da WCAG (texto 4,5:1; borda e foco 3:1)
  src/styles.css          importa tokens.css, fonts.css, design.css; mapeia --cor-fundo→--ink, --cor-superficie→--surface, --cor-texto→--paper, --cor-texto-suave→--muted, --cor-acento→--gold-bright, --cor-acento-texto→--ink, --cor-erro→--danger, --cor-ativo→--success, --raio→0; body com DM Sans e fallback
  src/marbles/            tela refeita: cabeçalho com marca INTERSECT LOGIC + título; duas colunas em tela larga (campo + coluna estreita com câmera pequena, contador, status, guia, ações), uma coluna em tela média/estreita; SegmentedControl no seletor de modo; botão "Depuração" na barra do campo abrindo o DrawerPanel; Notice de privacidade; CameraPanel compacto só por CSS num contêiner
  src/home/, src/round/, src/card/, cards.html   só herdam paleta e fontes pelos tokens; sem mudança de layout nem de comportamento
  package.json           o script `test` passa a incluir apps/web/scripts/design-tokens.test.mjs
README.md, docs/development-context/architecture/architecture-guide.md, docs/product/PROJECT_SPEC.md, specs/README.md   atualizados na fase de documentação
specs/2026-10-28-frontend-design-system-adopt-intersect-dark-gold/   esta spec (spec.md, clarification.md, research.md, plan.md, tasks.md, checklists/, validation.md ao fim)
```

## Design

### Componentes e responsabilidades

- **tokens.css** — declara todas as variáveis CSS do design system com nomes semânticos; é a única fonte dos valores de cor, tipografia, espaçamento, forma, movimento e foco. Não importa nada; é importado por `styles.css`.
- **fonts.css** — declara `@font-face` de DM Sans e Space Grotesk apontando por caminho relativo para os woff2 versionados ao lado, com `font-display: swap`; nenhum `url()` http/https.
- **design.css** — classes dos componentes base, usando só os tokens; nenhuma cor literal fora dos tokens, nenhum `url()` externo.
- **Button** — variantes `primary` (dourado, texto tinta), `secondary` e `text`; sobe -3px no hover por 0.2s, desligado em `prefers-reduced-motion`; foco visível pelo token.
- **Panel** — contêiner de superfície elevada com borda de controle quando aplicável.
- **Eyebrow** — rótulo em Space Grotesk 600 caixa-alta com rastreamento, cor dourada sobre a tinta (nunca sobre papel).
- **Notice** — aviso (privacidade) com papel de `status`/`note` legível.
- **Steps** — lista ordenada com a etapa atual por `aria-current="step"`.
- **SegmentedControl** — `fieldset` com `legend` e `radio`s acessíveis, operável por teclado, para o seletor de modo.
- **Gaveta (DrawerToggle, DrawerPanel e useDrawer)** — botão com `aria-expanded` e `aria-controls`; o conteúdo começa recolhido e fica fora da árvore acessível quando fechado; o estado não persiste.
- **index.ts** — exporta os componentes e seus tipos.

### Contratos e dados

- Os componentes recebem `props` React tipadas; nenhum deles lê ou grava estado persistente. O hook `useDrawer` controla o aberto/fechado em estado local, reiniciando recolhida a cada montagem (sem `localStorage`).
- Os tokens são o contrato de estilo: as classes de `design.css` e o `styles.css` consomem só as variáveis de `tokens.css`; as variáveis antigas `--cor-*`/`--raio` passam a ser aliases dos tokens novos.
- O teste de tokens lê `tokens.css`, `fonts.css` e `design.css` como texto, verifica a presença das variáveis exigidas, a ausência de `http`/`https` em qualquer `url()`, que cada `@font-face` aponta para um arquivo existente, e calcula os contrastes pela fórmula oficial da WCAG (texto >= 4,5:1; borda de controle e foco >= 3:1).

### Fluxo

1. O `styles.css` importa `tokens.css`, `fonts.css` e `design.css` e redireciona as variáveis antigas para os tokens; o menu e o jogo de cartas passam a usar a paleta e as fontes novas sem mudar de layout.
2. A tela das bolinhas monta o cabeçalho (marca INTERSECT LOGIC + título), o `SegmentedControl` do modo, o campo grande, a coluna estreita com a câmera pequena, o contador, o status, o `Steps` do guia e as ações, e o `Notice` de privacidade.
3. O botão "Depuração" na barra do campo controla a gaveta (`DrawerPanel`): fechada por padrão (conteúdo fora da árvore acessível), abre ao acionar e anuncia o estado por `aria-expanded`; fecha ao acionar de novo; nunca persiste o estado.
4. Em tela média e estreita, o layout vira uma coluna e a câmera pequena vai para baixo do campo, sem rolagem horizontal; a versão compacta é só CSS.
5. A verificação roda o teste de tokens, os testes de componente e a inspeção visual em Chromium headless nas três larguras, registrada como texto em `validation.md`.

## Mapeamento de requisitos

| Requisito | Abordagem                                                                                                                                                      | Evidência planejada                                     |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| FR-001    | `tokens.css` com as variáveis semânticas; borda de controle --control-border #77756d (>= 3:1); raio 0; foco 2px --gold-bright offset 5px                       | `design-tokens.test.mjs`                                |
| FR-002    | `fonts.css` com `@font-face` de DM Sans e Space Grotesk apontando para os woff2 versionados, `font-display: swap`, fallback de sistema, sem url() http         | `design-tokens.test.mjs`                                |
| FR-003    | `styles.css` redireciona `--cor-*` e `--raio` para os tokens; menu e cartas herdam só paleta e fontes (CQ-002), sem mudar layout nem comportamento             | testes existentes de menu e cartas verdes; teste visual |
| FR-004    | Componentes base em `apps/web/src/design/` (Button, Panel, Eyebrow, Notice, Steps, SegmentedControl, DrawerToggle, DrawerPanel) com testes ao lado             | testes de componente (Vitest)                           |
| FR-005    | Tela das bolinhas refeita: campo grande, câmera pequena em coluna estreita, guia/contador/status/ações junto ao campo, gaveta de depuração recolhida por botão | `MarblesScreen.test.tsx`; teste visual nas 3 larguras   |
| FR-006    | Nenhuma mudança nas regras de jogo; só apresentação e layout; testes de lógica e de componente das bolinhas e das cartas seguem verdes                         | testes existentes verdes                                |
| FR-007    | Foco visível dourado pelo token em todo controle; `SegmentedControl` e a gaveta operáveis por teclado com papéis e estados anunciados                          | testes de componente; teste de tokens (foco >= 3:1)     |

## Estratégia test-first

1. Escrever `apps/web/scripts/design-tokens.test.mjs` falhando (variáveis exigidas ausentes, `@font-face` sem arquivo, contrastes) e os testes de componente falhando (estado recolhido inicial, `aria-expanded`/`aria-controls`, teclado, `role`s), confirmando a falha esperada;
2. implementar `tokens.css`, `fonts.css`, versionar os woff2 com o aviso OFL e ler as licenças (registrando o resultado em `research.md`), e confirmar o teste de tokens verde;
3. implementar os componentes base e `design.css`, e confirmar os testes de componente verdes;
4. redirecionar as variáveis em `styles.css` e confirmar que os testes do menu e do jogo de cartas seguem verdes (sem regressão de layout nem de comportamento);
5. refazer a tela das bolinhas com os componentes novos (os testes que liam o painel passam a abrir a gaveta antes), e confirmar verdes;
6. rodar a inspeção visual em Chromium headless (1440, 900, 390, câmera simulada) e registrar como texto em `validation.md`;
7. atualizar a documentação e o catálogo, executar os gates oficiais e fechar o Gate 3.

## Riscos, rollout e rollback

| Risco                                                                       | Mitigação                                                                                                 | Rollback/contingência                                        |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| As licenças OFL não permitirem versionar os woff2                           | Ler as licenças na fonte antes de fechar a entrega e registrar o resultado em `research.md` (H-02)        | Recuar para a opção B da CQ-001 (baixar no `prepare:assets`) |
| Redirecionar as variáveis mudar a aparência do menu ou do jogo de cartas    | Herdar só paleta e fontes (CQ-002), sem tocar no layout; testes existentes de menu e cartas verdes (H-03) | Escopar as variáveis às telas afetadas                       |
| Teste existente que assume o painel de depuração visível                    | O padrão passa a recolhido; o teste abre a gaveta explicitamente antes de ler a depuração                 | Ajustar o teste para abrir a gaveta                          |
| Layout em 390px com campo grande e câmera pequena causar rolagem horizontal | Em tela estreita o layout vira uma coluna e a câmera vai para baixo; verificação visual nas três larguras | Reduzir o campo ou reempilhar em mais um ponto de quebra     |
| Os tokens lidos do site mudarem se o site for atualizado                    | Valores registrados em `research.md` como fatos de uma sessão (H-01)                                      | Reler os tokens do site e atualizar `research.md`            |

## Constitution Check — pós-design

| Princípio/gate                              | Resultado | Evidência ou exceção                                                                                                         |
| ------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------- |
| I. Intenção antes da implementação          | PASS      | O design não introduz comportamento fora de `spec.md`; só adiciona apresentação e refaz o layout da tela das bolinhas.       |
| II. Uma fonte vigente                       | PASS      | O plano referencia IDs; não duplica o comportamento de jogo, que segue nas specs das bolinhas e das cartas.                  |
| III. Rastreabilidade                        | PASS      | Matriz de requisitos acima e cobertura por tarefa formal em `tasks.md`.                                                      |
| IV. Test-first e incremental                | PASS      | Teste de tokens e testes de componente antes da implementação; herança por aliases é uma mudança pequena e reversível.       |
| V. Evidência honesta                        | PASS      | Contrastes medidos pela fórmula da WCAG; nenhuma afirmação de acessibilidade comprovada, desempenho ou aparência ao vivo.    |
| VI. Fronteira, privacidade e segredos       | PASS      | Fontes servidas pela própria origem; o teste de tokens proíbe `url()` http/https; sem imagem ou fonte em rede de terceiros.  |
| VII. Neutralidade e contexto sob demanda    | PASS      | Sem regra específica de provedor de agente; contexto técnico atualizado em `docs/` na fase de documentação.                  |
| VIII. Clareza, preservação, operação segura | PASS      | UTF-8 e acentuação; menu, jogo de cartas e testes de lógica preservados; `--raio` vira 0 por alias sem quebrar consumidores. |

## Complexidade e desvios

| Necessidade   | Impacto | Alternativa mais simples rejeitada | Aprovação |
| ------------- | ------- | ---------------------------------- | --------- |
| Nenhum desvio | —       | —                                  | —         |
