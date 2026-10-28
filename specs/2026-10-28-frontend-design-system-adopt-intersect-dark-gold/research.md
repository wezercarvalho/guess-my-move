# Pesquisa — 2026-10-28-frontend-design-system-adopt-intersect-dark-gold

## Pergunta

Como adotar um design system pequeno (tokens CSS e componentes base React) com a identidade escura com dourado do site da referência, servir as fontes pelo próprio app sem CDN, fazer o menu inicial e o jogo de cartas herdarem paleta e fontes sem mudar de layout nem de comportamento, e refazer a tela das bolinhas com campo grande, câmera pequena e depuração recolhida — tudo verificável sem afirmar acessibilidade, desempenho ou aparência final sem medição?

## Tokens lidos do site da referência (fatos)

Valores lidos do CSS publicado do site da Intersect Logic (intersectlogic.com) em 2026-10-28. São fatos observados nessa leitura (H-01).

### Cores

| Token (intenção)          | Valor no site    | Observação                                              |
| ------------------------- | ---------------- | ------------------------------------------------------- |
| tinta (`--ink`)           | #090909          | fundo escuro principal                                  |
| papel (`--paper`)         | #f6f4ef          | fundo claro das seções de papel                         |
| dourado (`--gold`)        | #c99400          | destaque; NÃO usar como texto sobre papel (reprova)     |
| dourado claro             | #e0aa08          | destaque e foco                                         |
| hover do botão            | #f1c52d          | preenchimento do botão no hover                         |
| apagado (`--muted`)       | #aaa8a0          | texto apagado sobre a tinta                             |
| texto secundário no papel | #686760          | texto secundário sobre o papel                          |
| borda de rodapé           | #292929          | borda decorativa sobre a tinta                          |
| borda de controle         | a medir (>= 3:1) | token novo; valor a fixar antes da implementação (H-04) |
| sucesso / ativo           | #2ecc71          | mantido do app atual                                    |
| erro                      | #ff6b6b          | mantido do app atual                                    |

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

A **licença OFL 1.1** de ambas NÃO foi lida na fonte nesta sessão e precisa ser confirmada antes de versionar os binários (H-02 / CQ-001).

## Contrastes medidos (WCAG 2.x, fórmula oficial)

Calculados pela fórmula oficial de razão de contraste da WCAG. Para texto o mínimo é 4,5:1; para bordas de controles interativos e foco, 3:1.

| Par (frente sobre fundo)          | Razão | Veredito para texto            |
| --------------------------------- | ----- | ------------------------------ |
| papel sobre tinta                 | 18,12 | passa                          |
| apagado (#aaa8a0) sobre tinta     | 8,36  | passa                          |
| dourado claro sobre tinta         | 9,41  | passa                          |
| dourado (#c99400) sobre tinta     | 7,32  | passa                          |
| tinta sobre dourado claro (botão) | 9,41  | passa (texto do botão)         |
| tinta sobre papel                 | 18,12 | passa                          |
| dourado (#c99400) sobre papel     | 2,47  | REPROVA (não usar como texto)  |
| #686760 sobre papel               | 5,17  | passa                          |
| papel sobre #141414               | 16,76 | passa                          |
| apagado sobre #141414             | 7,74  | passa                          |
| dourado claro sobre #141414       | 8,70  | passa                          |
| borda #292929 sobre tinta         | 1,37  | só decorativa (não é controle) |
| vermelho #ff6b6b sobre tinta      | 7,18  | passa                          |
| verde #2ecc71 sobre tinta         | 9,47  | passa                          |

Nota: a borda de rodapé #292929 (1,37:1) serve só como borda decorativa. Bordas de controles interativos precisam de pelo menos 3:1, então é preciso definir um **token de borda de controle** mais claro, a medir e registrar antes da implementação (H-04).

## Mapa das variáveis antigas para os tokens novos

As variáveis de `apps/web/src/styles.css` passam a apontar para os tokens novos, para o menu e o jogo de cartas herdarem a paleta e as fontes (CQ-002; forma exata a confirmar no Gate 1).

| Variável antiga      | Valor antigo | Token novo (intenção)                       |
| -------------------- | ------------ | ------------------------------------------- |
| `--cor-fundo`        | #11131a      | tinta (#090909)                             |
| `--cor-superficie`   | #1c1f2a      | superfície escura (ex.: #141414, a fixar)   |
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

- **Fontes e licença:** versionar os woff2 depende da licença OFL 1.1, que não foi lida na fonte (H-02). Se não confirmada, usar a opção B (baixar no `prepare:assets` com SHA-256).
- **Regressão visual no menu e nas cartas:** redirecionar as variáveis pode mudar a aparência do menu e do jogo de cartas de modo não intencional; a herança deve manter layout e comportamento e ser conferida pelos testes existentes (H-03).
- **Testes que dependem do painel de depuração aberto:** o padrão passa a recolhido; qualquer teste que assuma o painel visível precisa abrir a gaveta explicitamente.
- **Layout em telas estreitas:** o campo grande mais a câmera pequena precisam reorganizar-se em 390px sem rolagem horizontal; a reorganização é o ponto de maior risco de layout.
- **Borda de controle a medir:** o token de borda de controle (>= 3:1 sobre a tinta) ainda não tem valor fixado (H-04).

## Verificação prevista (sem afirmar o que não foi medido)

- Teste em Node que lê o CSS dos tokens: variáveis exigidas presentes, nenhum `http`/`https` em `url()`, contrastes calculados (texto >= 4,5:1; borda de controle e foco >= 3:1).
- Testes de componente dos componentes base, incluindo o estado recolhido inicial e o `aria-expanded`/`aria-controls` da gaveta.
- Verificação visual em Chromium headless nas larguras 1440, 900 e 390 com câmera simulada, registrada como TEXTO (sem salvar imagens no repositório).
- Comandos de verificação final: `yarn check:all`, `yarn test:gates`, `yarn test:sdd`, `yarn sdd:check`, `yarn docs:format:check`, `yarn security:dependencies`.

Nada aqui afirma acessibilidade comprovada, desempenho ou a aparência final: a aparência ao vivo depende do teste do maintainer no Chrome desktop e as licenças OFL seguem pendentes de confirmação.
