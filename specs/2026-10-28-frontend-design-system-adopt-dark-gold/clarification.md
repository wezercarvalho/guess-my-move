# Clarificação — 2026-10-28-frontend-design-system-adopt-intersect-dark-gold

## Contexto

- **Spec:** `spec.md`
- **Status de entrada:** `specified`
- **Status após o Gate 1:** `implementing`
- **Constituição:** `1.0.0`
- **Iniciada em:** `2026-10-28`

Esta clarificação registra as decisões do maintainer na sessão de 2026-10-28 (como fatos) e o resultado das questões de clarificação. O Gate 1 foi **aprovado antecipadamente** pelo maintainer em 2026-10-28 ("pode considerar os gates aprovados"), que aceitou as recomendações de CQ-001 a CQ-006; todas estão **RESOLVIDAS** abaixo. A spec avança para o planejamento técnico (plan.md e tasks.md) e para a implementação; a validação (validation.md) e o Gate 3 seguem ao fim, depois do código e da verificação visual.

### Decisões já tomadas pelo maintainer (2026-10-28, usadas como fatos)

- **D-01 — Identidade:** escura com dourado, igual ao site da referência (a Intersect Logic, do próprio maintainer). Incorporada no Resumo, no Problema, em FR-001 e em FR-002.
- **D-02 — Tela das bolinhas:** campo grande e câmera pequena. Incorporada em US-001, FR-005 e SC-003.
- **D-03 — Painel de depuração:** recolhido por padrão, abre por um botão. Incorporada em US-002, FR-005 e FR-004 (gaveta).
- **D-04 — Primeira entrega:** tokens, componentes base e a tela das bolinhas; o menu inicial e o jogo de cartas ficam fora do redesenho de layout. Incorporada no Resumo, em Fora de escopo e em FR-003/FR-006.

## Log de decisões

### CQ-001 — Como entregar as fontes DM Sans e Space Grotesk

- **Data:** `2026-10-28`
- **Impacto:** alto
- **Pergunta:** Como servir as duas fontes pelo próprio app, sem CDN?
- **Decisão:** **RESOLVIDA** — opção A, aprovada pelo maintainer em 2026-10-28. Versionar os dois arquivos woff2 em `apps/web/src/design/fonts` com o aviso de licença OFL ao lado, e declará-los por `@font-face`.
    - **A (escolhida):** versionar os dois arquivos woff2 em `apps/web/src/design/fonts` com o aviso de licença OFL, e declará-los por `@font-face`.
    - **B:** baixar no `prepare:assets` (como os modelos do MediaPipe já fazem), com SHA-256 fixado, a partir do site do maintainer.
    - **C:** usar pacotes npm das fontes (acrescenta dependências).
- **Razão:** versionar mantém o app sem requisição a terceiros e sem passo de download, coerente com as fontes do próprio site. A ressalva da H-02 foi RESOLVIDA na implementação: as licenças **OFL 1.1 de DM Sans e de Space Grotesk foram lidas na fonte** em 2026-10-28 e permitem versionar e redistribuir os binários pelo app com o aviso ao lado (resultado registrado em `research.md`); a opção B (baixar no `prepare:assets`) não foi necessária.
- **Alternativas rejeitadas:** CDN público (viola "sem requisição a terceiros").
- **Seções atualizadas em `spec.md`:** FR-002, H-02, NFR-004.

### CQ-002 — O menu inicial e o jogo de cartas herdam só paleta e fontes, ou permanecem 100% inalterados?

- **Data:** `2026-10-28`
- **Impacto:** alto
- **Pergunta:** Ao redirecionar as variáveis antigas para os tokens novos, o menu e o jogo de cartas devem herdar a nova paleta e as fontes (recomendado), ou devem permanecer visualmente idênticos ao de hoje por escopo de variáveis?
- **Decisão:** **RESOLVIDA** — aprovada pelo maintainer em 2026-10-28. O menu inicial e o jogo de cartas herdam **só paleta e fontes** pelos tokens, mantendo o layout e o comportamento; o redesenho de layout dessas telas segue fora de escopo (D-04).
- **Razão:** herdar a paleta pelos tokens dá coesão sem mexer no layout; manter 100% inalterado exigiria escopar as variáveis e perderia a coesão visual pedida.
- **Alternativas rejeitadas:** redesenhar o menu e as cartas agora (fora de escopo, D-04).
- **Seções atualizadas em `spec.md`:** Resumo, FR-003, US-003, H-03.

### CQ-003 — Posição e tamanho da câmera pequena na tela das bolinhas

- **Data:** `2026-10-28`
- **Impacto:** médio
- **Pergunta:** Onde fica a câmera pequena em relação ao campo grande, e de que tamanho?
- **Decisão:** **RESOLVIDA** — aprovada pelo maintainer em 2026-10-28. A câmera pequena fica numa **coluna estreita à direita do campo** em tela larga e passa para **abaixo do campo** em tela estreita; o tamanho pequeno é fixado na medição visual da implementação.
- **Razão:** uma coluna estreita à direita preserva o campo grande sem cobrir o jogo; a sobreposição no canto do campo é a alternativa.
- **Alternativas rejeitadas:** câmera grande ao lado do campo (contraria D-02).
- **Seções atualizadas em `spec.md`:** US-001, FR-005.

### CQ-004 — Marca no cabeçalho como texto ou aguardar logotipo

- **Data:** `2026-10-28`
- **Impacto:** baixo
- **Pergunta:** A marca no cabeçalho deve ser o texto "INTERSECT LOGIC" em Space Grotesk (como no site), sem imagem, ou deve aguardar um logotipo?
- **Decisão:** **RESOLVIDA** — aprovada pelo maintainer em 2026-10-28. A marca no cabeçalho é o **texto "INTERSECT LOGIC"** em Space Grotesk, sem imagem, coerente com o "sem logotipo e imagens" do escopo.
- **Razão:** o site usa a marca como texto; não há logotipo nesta entrega (fora de escopo).
- **Alternativas rejeitadas:** aguardar um arquivo de logotipo (atrasa a entrega sem necessidade).
- **Seções atualizadas em `spec.md`:** Fora de escopo, FR-001 (tipografia da marca).

### CQ-005 — Botão de depuração: lugar e persistência do estado aberto

- **Data:** `2026-10-28`
- **Impacto:** médio
- **Pergunta:** Onde fica o botão que abre a depuração, e o estado aberto deve persistir entre partidas ou recargas?
- **Decisão:** **RESOLVIDA** — aprovada pelo maintainer em 2026-10-28. O botão de depuração fica **na barra do campo**; o estado aberto **NÃO persiste** (volta a recolhido a cada abertura da tela), por privacidade e simplicidade.
- **Razão:** não persistir mantém o padrão recolhido de D-03 em cada abertura e evita guardar estado; o botão junto ao campo fica perto do que ele controla.
- **Alternativas rejeitadas:** persistir o estado aberto (expõe o diagnóstico por padrão em visitas seguintes).
- **Seções atualizadas em `spec.md`:** US-002, FR-004, FR-005.

### CQ-006 — Cores semânticas para sucesso, erro e armado

- **Data:** `2026-10-28`
- **Impacto:** médio
- **Pergunta:** Quais cores semânticas usar para sucesso, erro e o estado "armado" da mira?
- **Decisão:** **RESOLVIDA** — aprovada pelo maintainer em 2026-10-28. Manter o verde **#2ecc71** (sucesso/ativo) e o vermelho **#ff6b6b** (erro), já medidos sobre a tinta (9,47:1 e 7,18:1), por serem legíveis no fundo escuro e já usados no app; o dourado fica para destaque, não para sucesso/erro.
- **Razão:** ambos passam o contraste sobre a tinta e evitam introduzir cores novas sem medição; o dourado fica para destaque, não para sucesso/erro.
- **Alternativas rejeitadas:** derivar sucesso/erro do dourado (confunde com o destaque e reprova sobre papel).
- **Seções atualizadas em `spec.md`:** FR-001, NFR-001, Edge cases.

## Hipóteses remanescentes

- As licenças OFL 1.1 de DM Sans e Space Grotesk foram lidas na fonte em 2026-10-28 e permitem versionar e redistribuir os woff2 pelo app (resultado em `research.md`); H-02 fechada (CQ-001).
- Os tokens foram lidos do CSS publicado do site em uma sessão e podem mudar se o site for atualizado (H-01).
- O token de borda de controle foi fixado em **#77756d** (medido: 4,31 sobre a tinta, 4,06 sobre a superfície #121212, 3,77 sobre a superfície elevada #1a1a1a, todos acima de 3:1), fechando a H-04.
- Herdar paleta e fontes no menu e nas cartas não deve mudar o layout nem o comportamento, a confirmar visualmente e pelos testes (H-03).
- Nada foi verificado visualmente ao vivo no desktop do maintainer; a aparência final depende do teste dele.

## Questões resolvidas na aprovação da clarificação

Todas as questões abaixo foram decididas pelo maintainer na aprovação antecipada da clarificação (2026-10-28), pelas recomendações registradas acima:

- **CQ-001** — entrega das fontes: opção **A** (versionar os woff2 em `apps/web/src/design/fonts` com aviso OFL), leitura das licenças OFL pendente para a implementação.
- **CQ-002** — menu e cartas **herdam só paleta e fontes**, sem mudar layout nem comportamento.
- **CQ-003** — câmera pequena em **coluna estreita à direita** do campo, **abaixo** em tela estreita.
- **CQ-004** — marca no cabeçalho como **texto "INTERSECT LOGIC"**.
- **CQ-005** — botão de depuração **na barra do campo**; estado aberto **não persiste**.
- **CQ-006** — cores semânticas: **manter #2ecc71 (sucesso) e #ff6b6b (erro)**.

## Gate 1 — Clarificação aprovada

- **Status:** aprovado
- **Aprovador:** wezercarvalho (maintainer)
- **Data:** `2026-10-28`
- **Artefatos aprovados:** `spec.md`, `clarification.md`
- **Referência:** issue 74 do repositório (ver `spec.md`); mensagem do maintainer na sessão do dashboard em 2026-10-28 ("pode considerar os gates aprovados"), aprovando antecipadamente os Gates 1 e 2 e aceitando as recomendações de CQ-001 a CQ-006.
- **Observações:** aprovação antecipada no chat. CQ-001 a CQ-006 ficam RESOLVIDAS pelas recomendações. A spec avança para `implementing` com plan.md e tasks.md. Pendências de medição mantidas e declaradas: as licenças OFL 1.1 das fontes ainda serão lidas na fonte na implementação (H-02), e a aparência ao vivo no Chrome desktop depende do teste do maintainer. O Gate 3 segue para o fim, após o código e a verificação visual registrada em `validation.md`.
