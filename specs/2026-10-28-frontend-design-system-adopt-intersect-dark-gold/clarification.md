# Clarificação — 2026-10-28-frontend-design-system-adopt-intersect-dark-gold

## Contexto

- **Spec:** `spec.md`
- **Status de entrada:** `specified`
- **Constituição:** `1.0.0`
- **Iniciada em:** `2026-10-28`

Esta clarificação registra as decisões já tomadas pelo maintainer na sessão de 2026-10-28 (como fatos) e lista as questões que ainda precisam da resposta dele antes do planejamento técnico. O Gate 1 está **PENDENTE**: nenhuma fase seguinte (plano, tarefas, implementação) foi iniciada, e nenhum gate foi marcado como aprovado.

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
- **Decisão:** PENDENTE do maintainer. Recomendação: opção A.
    - **A (recomendada):** versionar os dois arquivos woff2 em `apps/web/src/design/fonts` com o aviso de licença OFL, e declará-los por `@font-face`.
    - **B:** baixar no `prepare:assets` (como os modelos do MediaPipe já fazem), com SHA-256 fixado, a partir do site do maintainer.
    - **C:** usar pacotes npm das fontes (acrescenta dependências).
- **Razão da recomendação:** versionar mantém o app sem requisição a terceiros e sem passo de download, coerente com as fontes do próprio site. Ressalva obrigatória: as licenças **OFL 1.1 de DM Sans e de Space Grotesk NÃO foram lidas na fonte nesta sessão** e precisam ser confirmadas antes de versionar (H-02). Se a licença não for confirmada, a opção B evita versionar o binário.
- **Alternativas rejeitadas:** CDN público (viola "sem requisição a terceiros").
- **Seções atualizadas em `spec.md`:** FR-002, H-02, NFR-004.

### CQ-002 — O menu inicial e o jogo de cartas herdam só paleta e fontes, ou permanecem 100% inalterados?

- **Data:** `2026-10-28`
- **Impacto:** alto
- **Pergunta:** Ao redirecionar as variáveis antigas para os tokens novos, o menu e o jogo de cartas devem herdar a nova paleta e as fontes (recomendado), ou devem permanecer visualmente idênticos ao de hoje por escopo de variáveis?
- **Decisão:** PENDENTE. Recomendação: herdar só paleta e fontes, mantendo o layout e o comportamento, para uma aparência coesa com baixo custo; o redesenho de layout dessas telas segue fora de escopo (D-04).
- **Razão da recomendação:** herdar a paleta pelos tokens dá coesão sem mexer no layout; manter 100% inalterado exigiria escopar as variáveis e perderia a coesão visual pedida.
- **Alternativas rejeitadas:** redesenhar o menu e as cartas agora (fora de escopo, D-04).
- **Seções atualizadas em `spec.md`:** Resumo, FR-003, US-003, H-03.

### CQ-003 — Posição e tamanho da câmera pequena na tela das bolinhas

- **Data:** `2026-10-28`
- **Impacto:** médio
- **Pergunta:** Onde fica a câmera pequena em relação ao campo grande, e de que tamanho?
- **Decisão:** PENDENTE. Recomendação: coluna estreita à direita do campo em tela larga, reposicionada abaixo do campo em tela estreita; tamanho a fixar na medição visual.
- **Razão da recomendação:** uma coluna estreita à direita preserva o campo grande sem cobrir o jogo; a sobreposição no canto do campo é a alternativa.
- **Alternativas rejeitadas:** câmera grande ao lado do campo (contraria D-02).
- **Seções atualizadas em `spec.md`:** US-001, FR-005.

### CQ-004 — Marca no cabeçalho como texto ou aguardar logotipo

- **Data:** `2026-10-28`
- **Impacto:** baixo
- **Pergunta:** A marca no cabeçalho deve ser o texto "INTERSECT LOGIC" em Space Grotesk (como no site), sem imagem, ou deve aguardar um logotipo?
- **Decisão:** PENDENTE. Recomendação: texto em Space Grotesk, sem imagem, coerente com o "sem logotipo e imagens" do escopo.
- **Razão da recomendação:** o site usa a marca como texto; não há logotipo nesta entrega (fora de escopo).
- **Alternativas rejeitadas:** aguardar um arquivo de logotipo (atrasa a entrega sem necessidade).
- **Seções atualizadas em `spec.md`:** Fora de escopo, FR-001 (tipografia da marca).

### CQ-005 — Botão de depuração: lugar e persistência do estado aberto

- **Data:** `2026-10-28`
- **Impacto:** médio
- **Pergunta:** Onde fica o botão que abre a depuração, e o estado aberto deve persistir entre partidas ou recargas?
- **Decisão:** PENDENTE. Recomendação: botão na barra do campo; o estado aberto NÃO persiste (volta a recolhido), por privacidade e simplicidade.
- **Razão da recomendação:** não persistir mantém o padrão recolhido de D-03 em cada abertura e evita guardar estado; o botão junto ao campo fica perto do que ele controla.
- **Alternativas rejeitadas:** persistir o estado aberto (expõe o diagnóstico por padrão em visitas seguintes).
- **Seções atualizadas em `spec.md`:** US-002, FR-004, FR-005.

### CQ-006 — Cores semânticas para sucesso, erro e armado

- **Data:** `2026-10-28`
- **Impacto:** médio
- **Pergunta:** Quais cores semânticas usar para sucesso, erro e o estado "armado" da mira?
- **Decisão:** PENDENTE. Recomendação: manter o verde #2ecc71 (sucesso/ativo) e o vermelho #ff6b6b (erro), já medidos sobre a tinta (9,47:1 e 7,18:1), por serem legíveis no fundo escuro e já usados no app.
- **Razão da recomendação:** ambos passam o contraste sobre a tinta e evitam introduzir cores novas sem medição; o dourado fica para destaque, não para sucesso/erro.
- **Alternativas rejeitadas:** derivar sucesso/erro do dourado (confunde com o destaque e reprova sobre papel).
- **Seções atualizadas em `spec.md`:** FR-001, NFR-001, Edge cases.

## Hipóteses remanescentes

- As licenças OFL 1.1 de DM Sans e Space Grotesk não foram lidas na fonte e precisam ser confirmadas antes de versionar os woff2 (H-02 / CQ-001).
- Os tokens foram lidos do CSS publicado do site em uma sessão e podem mudar se o site for atualizado (H-01).
- O token de borda de controle (contraste de pelo menos 3:1 sobre a tinta) ainda não tem valor fixado; será medido antes da implementação (H-04).
- Herdar paleta e fontes no menu e nas cartas não deve mudar o layout nem o comportamento, a confirmar visualmente e pelos testes (H-03).
- Nada foi verificado visualmente ao vivo no desktop do maintainer; a aparência final depende do teste dele.

## Perguntas que precisam de resposta do maintainer (Gate 1)

Nenhuma destas é bloqueante para a redação da spec, mas todas precisam da decisão do maintainer antes do plano técnico:

- **CQ-001** — como entregar as fontes (A versionar woff2 / B baixar no `prepare:assets` com SHA-256 / C pacotes npm); recomendado A, pendente da confirmação das licenças OFL.
- **CQ-002** — menu e cartas herdam só paleta e fontes (recomendado) ou permanecem 100% inalterados.
- **CQ-003** — posição e tamanho da câmera pequena (recomendado: coluna estreita à direita, abaixo em tela estreita).
- **CQ-004** — marca no cabeçalho como texto (recomendado) ou aguardar logotipo.
- **CQ-005** — lugar do botão de depuração (recomendado: barra do campo) e se o estado aberto persiste (recomendado: não persistir).
- **CQ-006** — cores semânticas para sucesso, erro e armado (recomendado: manter #2ecc71 e #ff6b6b).

## Gate 1 — Clarificação aprovada

- **Status:** pendente
- **Aprovador:** a definir (maintainer wezercarvalho)
- **Data:** a definir
- **Artefatos aprovados:** `spec.md`, `clarification.md`
- **Referência:** issue 74 do repositório (ver `spec.md`); aguardando a aprovação explícita do maintainer na sessão do dashboard.
- **Observações:** Gate 1 PENDENTE. A spec permanece em `specified`; o plano técnico (plan.md), as tarefas (tasks.md) e a validação (validation.md) só começam após a aprovação do maintainer, que também decide CQ-001 a CQ-006. Nenhum gate foi marcado como aprovado por esta sessão.
