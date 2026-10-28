---
id: 2026-10-28-frontend-design-system-adopt-intersect-dark-gold
title: Adotar um design system escuro com dourado e refazer a tela das bolinhas
slug: frontend-design-system-adopt-intersect-dark-gold
strategy: sdd
domain: frontend
capability: design-system
objective: adopt-intersect-dark-gold
summary: Adota um design system pequeno (tokens CSS e componentes base React) com a identidade escura com dourado da referência de design pedida pelo maintainer — fundo quase preto, papel claro, dourado de destaque, Space Grotesk nos títulos, DM Sans no corpo, cantos retos e botão dourado quadrado — servindo as duas fontes pelo próprio app sem CDN. As variáveis antigas cor-asterisco e raio passam a apontar para os tokens novos, de modo que o menu inicial e o jogo de cartas herdam paleta e fontes sem mudar de layout nem de comportamento. A tela das bolinhas é refeita com campo grande, câmera pequena, guia, contador, status e ações junto ao campo e o painel de depuração recolhido por padrão, abrindo por um botão com estado anunciado, responsiva nas larguras larga, média e estreita sem rolagem horizontal. Primeira entrega da issue 74; o redesenho do menu inicial e do jogo de cartas fica de fora. Spec parada no Gate 1 (pendente do maintainer); sem afirmar acessibilidade, desempenho ou aparência final sem medição.
status: specified
owners:
    - wezercarvalho
reviewers:
    - kirocrew
aliases:
    - design system
    - tokens de design
    - identidade escura com dourado
    - intersect logic
    - dourado
    - Space Grotesk
    - DM Sans
    - fontes próprias
    - sem CDN
    - cantos retos
    - botão dourado
    - foco visível
    - contraste
    - campo grande câmera pequena
    - gaveta de depuração
    - painel recolhido
    - componentes base
    - tela das bolinhas
    - apps/web/src/design
    - prefers-reduced-motion
code_paths:
    - apps/web/
related_specs:
    - 2026-10-27-game-marbles-bete-refine-flick-thumb-release
    - 2026-10-27-game-marbles-bete-build-pinch-shot
supersedes: []
branch: feat/74-design-system
constitution_version: 1.0.0
created_at: 2026-10-28
updated_at: 2026-10-28
---

# Adotar um design system escuro com dourado e refazer a tela das bolinhas

## Resumo

O app hoje usa uma paleta azul sobre azul-escuro, cantos arredondados (`--raio` 10px), a fonte do sistema e uma coluna de 720px; a tela das bolinhas empilha cabeçalho, aviso de privacidade, seletor de modo, guia de etapas, campo 800x600, contador, status, botão de nova rodada, câmera e um painel de depuração com cerca de 20 linhas sempre visível. O maintainer avaliou esse layout como "muito ruim" (avaliação dele, não medição) e pediu a identidade escura com dourado da referência de design (o site da Intersect Logic, intersectlogic.com, do próprio maintainer): fundo quase preto, papel claro, dourado de destaque, Space Grotesk nos títulos, DM Sans no corpo, cantos retos e botão dourado quadrado.

Esta spec entrega um **design system pequeno** em duas partes e aplica-o à tela das bolinhas. (1) **Tokens** como variáveis CSS em arquivo próprio, com nomes semânticos — cores (tinta, papel, dourado, dourado claro, hover do botão, apagado, texto secundário sobre papel, borda de rodapé, borda de controle a medir, sucesso, erro), tipografia (famílias, pesos, rastreamento, tamanhos), escala de espaçamento, forma com raio zero, movimento, foco e bordas de controle. As variáveis antigas `--cor-*` e `--raio` passam a apontar para os tokens novos, de modo que o menu inicial e o jogo de cartas **herdam paleta e fontes** sem mudar de layout nem de comportamento (a forma exata dessa herança é a CQ-002, a confirmar no Gate 1). As fontes DM Sans e Space Grotesk são **servidas pelo próprio app**, sem CDN nem requisição a terceiros, com `font-display: swap` e fallback de sistema. (2) **Componentes base** React em `apps/web/src/design/` — só os que a tela das bolinhas usa: botão (primário dourado, secundário, de texto), painel, rótulo "eyebrow", aviso, etapas do guia, seletor de modo como controle segmentado acessível e gaveta de depuração com botão e `aria-expanded`/`aria-controls`.

A **tela das bolinhas** é refeita: campo grande ocupando a maior parte da largura útil, câmera pequena (janela estreita), guia, contador, status e ações junto ao campo, depuração recolhida por padrão (abre por um botão com estado anunciado), responsiva nas larguras larga, média e estreita sem rolagem horizontal. O **comportamento de jogo** e os testes de lógica ficam inalterados. O redesenho do menu inicial e do jogo de cartas, o tema claro e o logotipo ficam fora desta entrega (a issue 74 pede esta como primeira entrega). Todos os pares de cor usados para texto declaram o contraste medido pela fórmula oficial da WCAG; nenhum texto afirma acessibilidade, desempenho ou aparência final sem a medição correspondente. Esta spec está parada no Gate 1, pendente da aprovação do maintainer.

## Problema

O CSS atual (`apps/web/src/styles.css`, cerca de 324 linhas) define `--cor-fundo` #11131a, `--cor-superficie` #1c1f2a, `--cor-texto` #f2f4f8, `--cor-texto-suave` #c3c9d6, `--cor-acento` #4f9cff, `--cor-erro` #ff6b6b, `--cor-ativo` #2ecc71 e `--raio` 10px, com a fonte do sistema e `.app` numa coluna de 720px (`.app-wide` 1200px nas bolinhas). É a paleta azul que o maintainer quer trocar.

O maintainer avaliou o layout atual como "muito ruim". Isso é **avaliação dele, não medição**: não há número que descreva "ruim". O que é **fato observável** no app: a tela das bolinhas (`apps/web/src/marbles/MarblesScreen.tsx`, `marbles.css`, `FlickGuide.tsx`, `MarblesDebugPanel.tsx`, com `CameraPanel` em `apps/web/src/camera`) empilha verticalmente cabeçalho, aviso de privacidade, seletor de modo, guia de etapas, campo 800x600, contador, status, botão de nova rodada, câmera e um painel de depuração com cerca de 20 linhas; o painel de depuração fica sempre visível e ocupa espaço mesmo fora de calibração. O menu inicial (`apps/web/src/home`) e o jogo de cartas (`cards.html`, `apps/web/src/round`, `card`) usam o mesmo `styles.css`.

A referência de design pedida é o site da Intersect Logic (do próprio maintainer). Dos tokens lidos do CSS publicado dele (`styles.css` do site), são fatos: fundo `--ink` #090909 e papel `--paper` #f6f4ef; dourado `--gold` #c99400 e `--gold-bright` #e0aa08, com hover do botão #f1c52d; apagado `--muted` #aaa8a0 e texto secundário sobre papel #686760; borda de rodapé #292929; títulos em Space Grotesk (peso 500, rastreamento -0.055em, entrelinha 0.99, tamanho `clamp(48px,5.3vw,76px)` no h1), corpo em DM Sans, rótulo "eyebrow" em Space Grotesk 600 12px caixa-alta com rastreamento 0.2em dourado, e a marca "INTERSECT LOGIC" em Space Grotesk 700 15px com rastreamento 0.17em; cantos retos (sem border-radius), botão dourado quadrado (padding 16px 20px, texto tinta, peso 700, 14px) que sobe 3px no hover numa transição de 0.2s; foco visível com outline 2px dourado-claro e offset 5px; seções alternando tinta e papel. As fontes do site são servidas como arquivos próprios (woff2 variável, pesos 400 a 700, subset latin).

Há um risco de contraste concreto: pela fórmula oficial da WCAG, o dourado #c99400 sobre papel #f6f4ef dá apenas 2,47:1, que **reprova** para texto — logo o dourado não pode ser usado como cor de texto sobre papel. As bordas puramente decorativas (como #292929 sobre a tinta, 1,37:1) são aceitáveis, mas a borda de um controle interativo precisa de pelo menos 3:1, então é preciso um token de borda de controle mais claro, ainda a medir.

## Objetivos

- Definir os tokens de design (cores, tipografia, escala de espaçamento, forma com raio zero, movimento, foco e bordas de controle) como variáveis CSS com nomes semânticos em um arquivo próprio, a partir dos valores lidos do site da referência.
- Servir as fontes DM Sans e Space Grotesk pelo próprio app, sem CDN nem requisição a terceiros, com `font-display: swap` e fallback de sistema.
- Fazer as variáveis antigas `--cor-*` e `--raio` apontarem para os tokens novos, de modo que o menu inicial e o jogo de cartas herdem a paleta e as fontes sem mudar de layout nem de comportamento.
- Criar em `apps/web/src/design/` só os componentes base que a tela das bolinhas usa (botão primário dourado, secundário e de texto; painel; rótulo "eyebrow"; aviso; etapas do guia; seletor de modo como controle segmentado acessível; gaveta de depuração com botão e `aria-expanded`/`aria-controls`).
- Refazer a tela das bolinhas com o campo grande ocupando a maior parte da largura útil, a câmera pequena numa janela estreita, o guia, o contador, o status e as ações junto ao campo e a depuração recolhida por padrão, responsiva nas larguras larga, média e estreita sem rolagem horizontal.
- Registrar, para cada par de cor de texto e fundo usado, o contraste medido pela fórmula oficial da WCAG, e definir um token de borda de controle com contraste de pelo menos 3:1.
- Preservar o comportamento de jogo e os testes de lógica das bolinhas e do jogo de cartas, sem regressão.

## Fora de escopo

- Redesenhar o layout do menu inicial (`apps/web/src/home`) e do jogo de cartas (`apps/web/src/round`, `card`, `cards.html`): nesta entrega eles só herdam a paleta e as fontes, sem mudar de layout nem de comportamento.
- Tema claro: a identidade desta entrega é escura com dourado; um tema claro alternável fica de fora.
- Logotipo e imagens: a marca no cabeçalho é texto, sem arquivo de imagem; nenhuma imagem ou vídeo é adicionado.
- Mudar a lógica de jogo (bolinhas ou cartas), a física, o detector de gestos ou o fluxo da rodada.
- Novas dependências (bibliotecas de UI, de ícones ou de fontes por pacote npm) sem aprovação explícita no Gate 1.
- Afirmar acessibilidade comprovada, desempenho (tempo de carga das fontes, fluidez) ou a aparência final sem a medição correspondente.

## Atores

- **Jogador:** usa a tela das bolinhas refeita (campo grande, câmera pequena) e, quando quer, abre a gaveta de depuração; percebe a nova identidade visual no app inteiro.
- **Maintainer:** aprova a identidade e o escopo (Gate 1), confere a tela das bolinhas no Chrome desktop, decide as questões de clarificação em aberto (entrega das fontes, herança do menu e cartas, posição da câmera, marca no cabeçalho, botão de depuração, cores semânticas).
- **Pessoa usuária de teclado:** navega por todos os controles (botões, seletor de modo, gaveta de depuração) com foco visível dourado e ordem previsível.
- **Pessoa com movimento reduzido:** tem a elevação do botão e as transições desligadas por `prefers-reduced-motion`.
- **Menu inicial e jogo de cartas:** telas existentes que herdam a paleta e as fontes pelos tokens, sem mudança de layout nem de comportamento.

## Histórias de usuário

### US-001 — Ver a tela das bolinhas com campo grande e câmera pequena em tela larga (P1)

Como jogador, quero que em tela larga o campo das bolinhas ocupe a maior parte da largura útil e a câmera apareça pequena, para focar no jogo sem a câmera roubar espaço.

**Teste independente:** no Chrome desktop numa janela larga, abrir a tela das bolinhas; o campo ocupa a maior parte da largura útil e a câmera aparece numa janela estreita ao lado ou no canto do campo; guia, contador, status e ações ficam junto ao campo; não há rolagem horizontal.

**Critérios de aceitação:**

1. **Dado** a tela das bolinhas em uma janela larga, **quando** ela abre, **então** o campo ocupa a maior parte da largura útil e a câmera aparece pequena (janela estreita).
2. **Dado** a tela das bolinhas em qualquer uma das larguras de referência (larga, média, estreita), **quando** ela abre, **então** não há rolagem horizontal e os controles do jogo (guia, contador, status, ações) ficam visíveis junto ao campo.

### US-002 — Abrir e fechar a depuração por um botão (P1)

Como jogador, quero que o painel de depuração comece recolhido e abra por um botão, para que o uso normal não mostre as cerca de 20 linhas de diagnóstico.

**Teste independente:** abrir a tela das bolinhas; o painel de depuração está recolhido; acionar o botão de depuração abre o painel e o botão anuncia o estado; acionar de novo recolhe.

**Critérios de aceitação:**

1. **Dado** o uso normal, **quando** a tela das bolinhas abre, **então** o painel de depuração está recolhido e seu conteúdo não é exibido.
2. **Dado** o painel recolhido, **quando** o botão de depuração é acionado, **então** o painel abre e o botão expõe o estado por `aria-expanded` e aponta o painel por `aria-controls`; acionar de novo recolhe.

### US-003 — Ver a identidade escura com dourado em todo o app (P1)

Como jogador, quero que o app inteiro use a identidade escura com dourado, para uma aparência coesa; o menu inicial e o jogo de cartas herdam a paleta e as fontes sem mudar de lugar.

**Teste independente:** abrir o menu inicial, a tela das bolinhas e o jogo de cartas; todos usam a paleta escura com dourado e as fontes Space Grotesk e DM Sans; o layout e o comportamento do menu e do jogo de cartas não mudaram.

**Critérios de aceitação:**

1. **Dado** qualquer página do app, **quando** carregada, **então** ela usa os tokens de cor escura com dourado e as fontes Space Grotesk (títulos) e DM Sans (corpo), com cantos retos.
2. **Dado** o menu inicial e o jogo de cartas, **quando** carregados, **então** herdam a paleta e as fontes pelos tokens, sem mudança de layout nem de comportamento, e seus testes existentes continuam passando.

### US-004 — Navegar por teclado com foco visível (P1)

Como pessoa que usa teclado, quero alcançar todos os controles com um foco visível claro, para operar o app sem mouse.

**Teste independente:** com o teclado, percorrer os controles da tela das bolinhas (botões, seletor de modo, botão de depuração); cada controle recebe um anel de foco visível dourado e a ordem é previsível.

**Critérios de aceitação:**

1. **Dado** qualquer controle interativo, **quando** recebe foco por teclado, **então** mostra um anel de foco visível (outline dourado-claro com offset) com contraste de pelo menos 3:1 contra o fundo adjacente.
2. **Dado** o seletor de modo e a gaveta de depuração, **quando** operados por teclado, **então** são alcançáveis e acionáveis, com os papéis e estados anunciados (controle segmentado acessível; `aria-expanded`/`aria-controls` na gaveta).

### US-005 — Respeitar movimento reduzido (P2)

Como pessoa com movimento reduzido, quero que as animações do botão e as transições sejam desligadas, para não ter movimento que me incomoda.

**Teste independente:** com `prefers-reduced-motion: reduce` ativo, passar o mouse pelo botão dourado; ele não sobe nem anima; as transições dos componentes ficam desligadas.

**Critérios de aceitação:**

1. **Dado** `prefers-reduced-motion: reduce`, **quando** um botão ou componente mudaria por transição, **então** a elevação do botão e as transições estão desligadas.

### US-006 — Garantir que nada da câmera e nenhuma fonte saia para terceiros (P1)

Como maintainer, quero confirmar que o app não faz requisição a domínio de terceiros, incluindo as fontes, para manter a privacidade.

**Teste independente:** inspecionar as requisições de rede ao carregar cada página do app; as fontes e todos os ativos vêm da própria origem; nenhuma requisição vai a domínio de terceiros nem carrega imagem, vídeo ou landmarks da câmera.

**Critérios de aceitação:**

1. **Dado** qualquer página do app, **quando** carregada, **então** nenhuma requisição vai a domínio de terceiros, inclusive para fontes (sem CDN, sem `@import` externo, sem `url()` http/https).
2. **Dado** o CSS dos tokens, **quando** buscado, **então** não há `http`/`https` em nenhum `url()` (as fontes são referenciadas por caminho da própria origem).

## Requisitos funcionais

- **FR-001:** O app DEVE definir os tokens de design como variáveis CSS com nomes semânticos em um arquivo próprio: cores (tinta, papel, dourado, dourado claro, hover do botão, apagado, texto secundário sobre papel, borda de rodapé, borda de controle, sucesso, erro), tipografia (família de título Space Grotesk, família de corpo DM Sans, pesos, rastreamentos e tamanhos, incluindo o rótulo "eyebrow" e a marca), uma escala de espaçamento, a forma com raio zero (equivalente ao `--raio` passar a 0), o movimento (duração e elevação do botão), o foco (cor, espessura e offset do outline) e as bordas de controle. Os valores DEVEM vir dos lidos do site da referência; a borda de controle DEVE ter contraste de pelo menos 3:1 contra o fundo adjacente.
- **FR-002:** As fontes DM Sans e Space Grotesk DEVEM ser servidas pelo próprio app (arquivos locais), sem CDN nem requisição a terceiros, declaradas por `@font-face` com `font-display: swap` e com fallback de sistema; nenhum `url()` do CSS dos tokens DEVE conter `http` ou `https`.
- **FR-003:** As variáveis antigas `--cor-fundo`, `--cor-superficie`, `--cor-texto`, `--cor-texto-suave`, `--cor-acento`, `--cor-acento-texto`, `--cor-erro`, `--cor-ativo` e `--raio` DEVEM passar a apontar para os tokens novos, de modo que o menu inicial e o jogo de cartas herdem a paleta e as fontes sem mudar de layout nem de comportamento. A forma exata dessa herança (herdar só paleta e fontes, recomendado; ou manter o menu e as cartas 100% inalterados por escopo de variáveis) é a CQ-002, a confirmar no Gate 1.
- **FR-004:** O app DEVE criar em `apps/web/src/design/` os componentes base React que a tela das bolinhas usa, e só esses: botão primário dourado, botão secundário e botão de texto; painel; rótulo "eyebrow"; aviso; etapas do guia; seletor de modo como controle segmentado acessível; e gaveta de depuração com um botão que expõe `aria-expanded` e aponta o conteúdo por `aria-controls`.
- **FR-005:** A tela das bolinhas DEVE ser refeita com o campo grande ocupando a maior parte da largura útil, a câmera pequena numa janela estreita, e o guia, o contador, o status e as ações junto ao campo; o painel de depuração DEVE começar recolhido e abrir e fechar por um botão com o estado anunciado; o layout DEVE ser responsivo nas larguras larga, média e estreita sem rolagem horizontal.
- **FR-006:** O comportamento de jogo (bolinhas e jogo de cartas) e os testes de lógica NÃO DEVEM mudar: os testes existentes de lógica e de componente das bolinhas e do jogo de cartas DEVEM continuar passando; esta entrega muda apresentação e layout, não regras de jogo.
- **FR-007:** O foco de teclado DEVE ser visível em todo controle interativo, com um outline dourado-claro e offset vindo do token de foco; a ordem de foco DEVE ser previsível e o seletor de modo e a gaveta de depuração DEVEM ser operáveis por teclado com papéis e estados anunciados.

## Requisitos não funcionais

- **NFR-001:** Para cada par de cor de texto e de fundo efetivamente usado, o contraste medido pela fórmula oficial da WCAG DEVE ser de pelo menos 4,5:1; para bordas de controles interativos e para o anel de foco, de pelo menos 3:1. A tabela de contrastes medida DEVE ser registrada em `research.md`, e o dourado #c99400 NÃO DEVE ser usado como cor de texto sobre papel (2,47:1, reprova).
- **NFR-002:** Com `prefers-reduced-motion: reduce`, a elevação do botão dourado no hover e as transições dos componentes DEVEM ser desligadas.
- **NFR-003:** Todo controle interativo DEVE ser alcançável e acionável por teclado, com alvo de toque adequado nos controles de toque; o seletor de modo DEVE permanecer um controle acessível (papéis e rótulos textuais) e a gaveta de depuração DEVE anunciar o estado por `aria-expanded`/`aria-controls`.
- **NFR-004:** Nenhuma requisição DEVE ir a domínio de terceiros em nenhuma página do app, inclusive para fontes; os ativos de fonte DEVEM ser servidos pela própria origem.
- **NFR-005:** A entrega DEVE incluir testes de componente dos componentes base e um teste em Node que leia o CSS dos tokens e confira as variáveis exigidas, a ausência de `http`/`https` em `url()` e os contrastes calculados; a verificação visual em Chromium headless nas larguras 1440, 900 e 390 com câmera simulada DEVE ser registrada como TEXTO, sem salvar imagens no repositório.
- **NFR-006:** Nenhum texto DEVE afirmar acessibilidade comprovada, desempenho ou a aparência final sem a medição correspondente; o que não foi medido (por exemplo a leitura das licenças OFL das fontes e a aparência ao vivo no desktop do maintainer) DEVE ser declarado como pendente.
- **NFR-007:** `yarn docs:format:check`, `yarn sdd:check` e `yarn test:sdd` DEVEM passar ao final da entrega documental; `yarn check:all`, `yarn test:gates` e `yarn security:dependencies` DEVEM continuar verdes quando o código for implementado.

## Edge cases

- Fonte ainda não carregada: com `font-display: swap`, o texto aparece primeiro no fallback de sistema e troca para a fonte própria ao carregar, sem bloquear a renderização.
- Tela estreita (390px de largura): o campo e a câmera reorganizam-se em coluna sem rolagem horizontal; a câmera continua pequena.
- Painel de depuração aberto por um teste existente: se algum teste depende do painel estar visível, o teste DEVE abrir a gaveta explicitamente, porque o padrão passa a ser recolhido (risco registrado em `research.md`).
- Dourado sobre papel em texto: proibido por contraste (2,47:1); o dourado é usado em texto só sobre a tinta (fundo escuro) ou como preenchimento de botão com texto tinta.
- `prefers-reduced-motion` ativo: sem elevação do botão e sem transições.
- Borda puramente decorativa com baixo contraste (ex.: #292929 sobre a tinta): aceitável porque não é borda de controle; a borda de controle usa o token próprio de pelo menos 3:1.

## Hipóteses e dependências

- **H-01:** Os tokens de cor, tipografia, forma e movimento lidos do CSS publicado do site da referência são os valores desejados; foram lidos em uma sessão e não foram revalidados contra uma eventual atualização do site.
- **H-02:** As licenças OFL 1.1 de DM Sans e de Space Grotesk permitem versionar ou redistribuir os arquivos woff2 pelo próprio app, mas essas licenças NÃO foram lidas na fonte nesta sessão e DEVEM ser confirmadas antes de versionar (CQ-001).
- **H-03:** Fazer o menu inicial e o jogo de cartas herdarem só a paleta e as fontes pelos tokens não altera o layout nem o comportamento deles; a confirmar visualmente e pelos testes existentes (risco de regressão em `research.md`).
- **H-04:** O token de borda de controle com contraste de pelo menos 3:1 sobre a tinta ainda não tem valor fixado; será medido e registrado antes da implementação.
- **Dependências:** a tela das bolinhas atual (`apps/web/src/marbles`, `apps/web/src/camera`) e seus testes; o `styles.css` compartilhado pelo menu e pelo jogo de cartas; os arquivos de fonte woff2 (DM Sans e Space Grotesk, subset latin) da referência; Chrome/Chromium desktop como alvo de verificação.

## Critérios mensuráveis de sucesso

- **SC-001:** Um teste em Node lê o CSS dos tokens e confirma a presença das variáveis exigidas, a ausência de `http`/`https` em qualquer `url()` e que os contrastes calculados dos pares de texto usados são de pelo menos 4,5:1 e os de borda de controle e foco de pelo menos 3:1.
- **SC-002:** Os testes de componente dos componentes base (botão, painel, rótulo, aviso, etapas, seletor de modo, gaveta de depuração) passam sem navegador, incluindo o estado recolhido inicial e o `aria-expanded`/`aria-controls` da gaveta.
- **SC-003:** A verificação visual em Chromium headless nas larguras 1440, 900 e 390 com câmera simulada é registrada como texto: campo grande e câmera pequena em 1440, sem rolagem horizontal em nenhuma largura, e depuração recolhida por padrão.
- **SC-004:** Os testes existentes de lógica e de componente das bolinhas e do jogo de cartas continuam passando sem regressão de comportamento.
- **SC-005:** `yarn docs:format:check`, `yarn sdd:check` e `yarn test:sdd` passam; `yarn check:all`, `yarn test:gates` e `yarn security:dependencies` passam quando o código for implementado.
- **SC-006:** A tabela de contrastes medida e o mapa das variáveis antigas para os tokens novos estão registrados em `research.md`, e as pendências sem medição (licenças OFL, aparência ao vivo) estão declaradas.
