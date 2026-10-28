# Pesquisa — 2026-10-28-frontend-design-system-adopt-intersect-dark-gold

## Pergunta

Como adotar um design system pequeno (tokens CSS e componentes base React) com a identidade escura com dourado do site da referência, servir as fontes pelo próprio app sem CDN, fazer o menu inicial e o jogo de cartas herdarem paleta e fontes sem mudar de layout nem de comportamento, e refazer a tela das bolinhas com campo grande, câmera pequena e depuração recolhida — tudo verificável sem afirmar acessibilidade, desempenho ou aparência final sem medição?

## Tokens lidos do site da referência (fatos)

Valores lidos do CSS publicado do site da Intersect Logic (intersectlogic.com) em 2026-10-28. São fatos observados nessa leitura (H-01).

### Cores

| Token (intenção)                                 | Valor no site | Observação                                                                                                              |
| ------------------------------------------------ | ------------- | ----------------------------------------------------------------------------------------------------------------------- |
| tinta (`--ink`)                                  | #090909       | fundo escuro principal                                                                                                  |
| superfície (`--surface`)                         | #121212       | superfície escura                                                                                                       |
| superfície elevada (`--surface-raised`)          | #1a1a1a       | superfície elevada (painéis, gaveta)                                                                                    |
| papel (`--paper`)                                | #f6f4ef       | fundo claro das seções de papel                                                                                         |
| texto secundário no papel (`--paper-text-muted`) | #686760       | texto secundário sobre o papel                                                                                          |
| dourado (`--gold`)                               | #c99400       | destaque; NÃO usar como texto sobre papel (reprova)                                                                     |
| dourado claro (`--gold-bright`)                  | #e0aa08       | destaque e foco                                                                                                         |
| hover do botão (`--gold-hover`)                  | #f1c52d       | preenchimento do botão no hover                                                                                         |
| apagado (`--muted`)                              | #aaa8a0       | texto apagado sobre a tinta                                                                                             |
| borda de rodapé (`--line`)                       | #292929       | borda decorativa sobre a tinta                                                                                          |
| borda de controle (`--control-border`)           | #77756d       | token novo, FIXADO; 4,31 sobre tinta, 4,06 sobre superfície, 3,77 sobre superfície elevada (todos >= 3:1), fecha a H-04 |
| sucesso / ativo (`--success`)                    | #2ecc71       | mantido do app atual                                                                                                    |
| erro (`--danger`)                                | #ff6b6b       | mantido do app atual                                                                                                    |

### Tipografia

| Elemento       | Fonte e estilo lidos do site                                         |
| -------------- | -------------------------------------------------------------------- |
| títulos        | Space Grotesk, peso 500, rastreamento -0.055em, entrelinha 0.99      |
| h1             | tamanho `clamp(48px, 5.3vw, 76px)`                                   |
| corpo          | DM Sans                                                              |
| rótulo eyebrow | Space Grotesk 600, 12px, caixa-alta, rastreamento 0.2em, cor dourada |
| marca          | "INTERSECT LOGIC" em Space Grotesk 700, 15px, rastreamento 0.17em    |

### Forma e movimento

- Cantos retos (sem border-radius).
- Botão dourado quadrado: padding 16px 20px, texto cor tinta, peso 700, 14px; sobe 3px no hover numa transição de 0.2s.
- Foco visível: outline 2px dourado-claro com offset de 5px.
- Seções alternando tinta e papel.

### Fontes (arquivos próprios do site)

Woff2 variável, pesos 400 a 700, subset latin:

- DM Sans: `assets/fonts/dm-sans-latin.woff2` (36932 bytes, SHA-256 `9fea608a947e67020c33cad9a6fe3d60c54119dfb8cff87768a8117a15ed7543`).
- Space Grotesk: `assets/fonts/space-grotesk-latin.woff2` (22288 bytes, SHA-256 `0640890476fc1198ab4de571fb658de443c4d85b66466ec09534a8737ab1ce9d`).

A **licença OFL 1.1** de ambas ainda NÃO foi lida na fonte nesta sessão. A decisão do Gate 1 (CQ-001, opção A) é versionar os binários; a leitura das licenças fica como tarefa da implementação, antes de fechar a entrega.

### Resultado da leitura das licenças OFL (lida na fonte em 2026-10-28)

As duas licenças foram lidas na fonte nos arquivos `OFL.txt` do repositório `google/fonts` (`ofl/dmsans` e `ofl/spacegrotesk`) e versionadas ao lado dos woff2 como `OFL-DM-Sans.txt` e `OFL-Space-Grotesk.txt`.

- **DM Sans — OFL 1.1 lida na fonte:** "Copyright 2014 The DM Sans Project Authors (https://github.com/googlefonts/dm-fonts)", sob a SIL Open Font License, Version 1.1.
- **Space Grotesk — OFL 1.1 lida na fonte:** "Copyright 2020 The Space Grotesk Project Authors (https://github.com/floriankarsten/space-grotesk)", sob a SIL Open Font License, Version 1.1.
- **Veredito (pode versionar e redistribuir pelo app?):** SIM. A cláusula de permissão da OFL 1.1 concede, sem custo, "to use, study, copy, merge, embed, modify, redistribute, and sell modified and unmodified copies of the Font Software", desde que cada cópia carregue o aviso de copyright e o texto da licença (condição atendida: os dois `OFL-*.txt` ficam ao lado dos woff2). Fecha a CQ-001 (opção A) e a H-02: os binários podem ser versionados e redistribuídos pelo app, sem o recuo da opção B.
- **Limitação:** não se comparou byte a byte os woff2 do site do maintainer com os do repositório `google/fonts`; são as mesmas famílias pelos nomes e pelo `@font-face` do site (H-01). Os SHA-256 versionados conferem: DM Sans `9fea608a947e67020c33cad9a6fe3d60c54119dfb8cff87768a8117a15ed7543`, Space Grotesk `0640890476fc1198ab4de571fb658de443c4d85b66466ec09534a8737ab1ce9d`.

### Decisão de ajuste de layout (verificação visual, 2026-10-28)

Na primeira versão da tela das bolinhas o campo ficava abaixo da dobra a 1440x900. Decisão tomada durante a verificação visual: mover o contador, o status e "Nova rodada" para a coluna lateral estreita (à direita do campo em tela larga) e limitar a largura do campo pela altura da janela (`100dvh` menos `20rem`, proporção 4:3), de modo que o campo inteiro caiba na janela sem rolagem. A câmera pequena fica nessa mesma coluna lateral (compactada só por CSS dentro de `.marbles-side`, sem alterar o `CameraPanel` compartilhado) e passa para baixo do campo abaixo de 960px.

### Resultado da verificação visual (Chromium headless, câmera simulada, 2026-10-28)

Servindo o build de produção por `http.server` em `127.0.0.1`, câmera simulada do Chromium (imagem de teste verde, sem mão real), registrado como TEXTO (sem salvar imagens no repositório):

- **1440x900:** sem rolagem horizontal (`scrollWidth` 1425 contra `clientWidth` 1425, barra de rolagem de 15px); campo 773x580 inteiro dentro da janela (topo em y=287); coluna lateral com câmera de 280 de largura (visualização 246x185); depuração recolhida (`aria-expanded` false) e, ao clicar, abre com 15 linhas.
- **900x900:** sem rolagem horizontal (885); campo 773x580; câmera abaixo do campo com 288 de largura.
- **390x844:** sem rolagem horizontal (390); campo 292x219; câmera com 288 de largura.
- **Fontes e cores:** `document.fonts.check` verdadeiro para "DM Sans" e "Space Grotesk"; fundo do body `rgb(9, 9, 9)` (`--ink`); título em Space Grotesk e corpo em DM Sans.
- **Rede:** 45 requisições na tela das bolinhas, todas GET para `127.0.0.1` (a própria origem), com as fontes servidas de `/assets/*.woff2`; 28 no menu inicial e 41 no jogo de cartas, todas GET para a própria origem.
- **Menu inicial e jogo de cartas:** conferidos a 1440 de largura; herdaram a paleta (fundo escuro, botões dourados, cantos retos) e as fontes, mantendo o mesmo layout e os mesmos textos.
- **Não verificado:** aparência com câmera e mão reais no desktop do maintainer; leitores de tela reais; Firefox e Safari (o seletor `:has()` do controle segmentado exige um navegador recente; só o Chromium foi exercitado); contraste do texto sobre o campo marrom do canvas e do canvas em si (não faz parte dos tokens).

## Contrastes medidos (WCAG 2.x, fórmula oficial)

Calculados pela fórmula oficial de razão de contraste da WCAG. Para texto o mínimo é 4,5:1; para bordas de controles interativos e foco, 3:1. Os três fundos escuros são a tinta `--ink` #090909, a superfície `--surface` #121212 e a superfície elevada `--surface-raised` #1a1a1a.

| Par (frente sobre fundo)                           | Razão | Veredito para texto             |
| -------------------------------------------------- | ----- | ------------------------------- |
| papel (#f6f4ef) sobre tinta                        | 18,12 | passa                           |
| papel sobre superfície (#121212)                   | 17,04 | passa                           |
| papel sobre superfície elevada (#1a1a1a)           | 15,83 | passa                           |
| apagado (#aaa8a0) sobre tinta                      | 8,36  | passa                           |
| apagado sobre superfície                           | 7,87  | passa                           |
| apagado sobre superfície elevada                   | 7,31  | passa                           |
| dourado claro (#e0aa08) sobre tinta                | 9,41  | passa                           |
| dourado claro sobre superfície                     | 8,85  | passa                           |
| dourado claro sobre superfície elevada             | 8,22  | passa                           |
| tinta sobre dourado claro (botão)                  | 9,41  | passa (texto do botão)          |
| tinta sobre hover do botão (#f1c52d)               | 12,1  | passa (texto do botão no hover) |
| vermelho #ff6b6b sobre tinta                       | 7,18  | passa                           |
| vermelho #ff6b6b sobre superfície                  | 6,75  | passa                           |
| vermelho #ff6b6b sobre superfície elevada          | 6,27  | passa                           |
| verde #2ecc71 sobre tinta                          | 9,47  | passa                           |
| verde #2ecc71 sobre superfície                     | 8,91  | passa                           |
| verde #2ecc71 sobre superfície elevada             | 8,28  | passa                           |
| tinta sobre papel                                  | 18,12 | passa                           |
| #686760 sobre papel                                | 5,17  | passa                           |
| dourado (#c99400) sobre papel                      | 2,47  | REPROVA (não usar como texto)   |
| borda de controle #77756d sobre tinta              | 4,31  | passa como borda (>= 3:1)       |
| borda de controle #77756d sobre superfície         | 4,06  | passa como borda (>= 3:1)       |
| borda de controle #77756d sobre superfície elevada | 3,77  | passa como borda (>= 3:1)       |
| foco: outline dourado claro #e0aa08 sobre tinta    | 9,41  | passa como foco (>= 3:1)        |
| borda #292929 sobre tinta                          | 1,37  | só decorativa (não é controle)  |

Nota: a borda de rodapé #292929 (1,37:1) serve só como borda decorativa. O **token de borda de controle** foi FIXADO em #77756d, com contraste de 4,31 sobre a tinta, 4,06 sobre a superfície e 3,77 sobre a superfície elevada — todos acima de 3:1 —, fechando a H-04.

## Mapa das variáveis antigas para os tokens novos

As variáveis de `apps/web/src/styles.css` passam a apontar para os tokens novos, para o menu e o jogo de cartas herdarem a paleta e as fontes (CQ-002; forma exata a confirmar no Gate 1).

| Variável antiga      | Valor antigo | Token novo (intenção)                       |
| -------------------- | ------------ | ------------------------------------------- |
| `--cor-fundo`        | #11131a      | tinta (#090909)                             |
| `--cor-superficie`   | #1c1f2a      | superfície escura (`--surface` #121212)     |
| `--cor-texto`        | #f2f4f8      | papel (#f6f4ef) como texto sobre a tinta    |
| `--cor-texto-suave`  | #c3c9d6      | apagado (#aaa8a0)                           |
| `--cor-acento`       | #4f9cff      | dourado claro (#e0aa08) / dourado (#c99400) |
| `--cor-acento-texto` | #06101f      | tinta (#090909) como texto sobre o dourado  |
| `--cor-erro`         | #ff6b6b      | erro (#ff6b6b, mantido)                     |
| `--cor-ativo`        | #2ecc71      | sucesso/ativo (#2ecc71, mantido)            |
| `--raio`             | 10px         | 0 (cantos retos)                            |

## Inventário do CSS atual e dos componentes a criar

### CSS atual (fato)

`apps/web/src/styles.css` (cerca de 324 linhas) define `--cor-fundo` #11131a, `--cor-superficie` #1c1f2a, `--cor-texto` #f2f4f8, `--cor-texto-suave` #c3c9d6, `--cor-acento` #4f9cff, `--cor-acento-texto` #06101f, `--cor-erro` #ff6b6b, `--cor-ativo` #2ecc71 e `--raio` 10px; `color-scheme: light dark`; a fonte do sistema; `.app` com `max-width` 720px (e `.app-wide` 1200px nas bolinhas). É compartilhado pelo menu inicial, pela tela das bolinhas e pelo jogo de cartas.

### Tela das bolinhas (fato)

`apps/web/src/marbles/MarblesScreen.tsx`, `marbles.css`, `FlickGuide.tsx`, `MarblesDebugPanel.tsx`, com `CameraPanel` em `apps/web/src/camera`. Empilha verticalmente: cabeçalho, aviso de privacidade, seletor de modo, guia de etapas, campo 800x600, contador, status, botão de nova rodada, câmera e um painel de depuração com cerca de 20 linhas, sempre visível. O menu inicial está em `apps/web/src/home` e o jogo de cartas em `cards.html`, `apps/web/src/round` e `card`.

### Componentes base a criar em `apps/web/src/design/` (só os que a tela das bolinhas usa)

- Botão: primário dourado, secundário, de texto.
- Painel.
- Rótulo "eyebrow".
- Aviso.
- Etapas do guia.
- Seletor de modo como controle segmentado acessível.
- Gaveta de depuração com botão e `aria-expanded`/`aria-controls`.

## Riscos

- **Fontes e licença:** as licenças OFL 1.1 de DM Sans e de Space Grotesk foram LIDAS na fonte (ver a seção acima) e permitem versionar e redistribuir os woff2 pelo app, com o aviso ao lado (H-02 FECHADA). A opção B (baixar no `prepare:assets`) deixou de ser necessária.
- **Regressão visual no menu e nas cartas:** redirecionar as variáveis pode mudar a aparência do menu e do jogo de cartas de modo não intencional; a herança deve manter layout e comportamento e ser conferida pelos testes existentes (H-03).
- **Testes que dependem do painel de depuração aberto:** o padrão passa a recolhido; qualquer teste que assuma o painel visível precisa abrir a gaveta explicitamente.
- **Layout em telas estreitas:** o campo grande mais a câmera pequena precisam reorganizar-se em 390px sem rolagem horizontal; a reorganização é o ponto de maior risco de layout.
- **Borda de controle:** FIXADA em #77756d (4,31 sobre a tinta, 4,06 sobre a superfície, 3,77 sobre a superfície elevada, todos >= 3:1); a H-04 está fechada.

## Verificação prevista (sem afirmar o que não foi medido)

- Teste em Node que lê o CSS dos tokens: variáveis exigidas presentes, nenhum `http`/`https` em `url()`, contrastes calculados (texto >= 4,5:1; borda de controle e foco >= 3:1).
- Testes de componente dos componentes base, incluindo o estado recolhido inicial e o `aria-expanded`/`aria-controls` da gaveta.
- Verificação visual em Chromium headless nas larguras 1440, 900 e 390 com câmera simulada, registrada como TEXTO (sem salvar imagens no repositório).
- Comandos de verificação final: `yarn check:all`, `yarn test:gates`, `yarn test:sdd`, `yarn sdd:check`, `yarn docs:format:check`, `yarn security:dependencies`.

Nada aqui afirma acessibilidade comprovada, desempenho ou a aparência final: a aparência ao vivo depende do teste do maintainer no Chrome desktop, não feito antes do merge. As licenças OFL 1.1 das fontes foram lidas na fonte e permitem a redistribuição (H-02 fechada); a verificação visual em Chromium headless foi executada e registrada acima.
