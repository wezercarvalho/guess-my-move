---
id: 2026-10-29-game-arranha-teia-add-wall-climb
title: Escalar paredes no Arranha-Teia agarrando com as mãos abertas
slug: game-arranha-teia-add-wall-climb
strategy: sdd
domain: game
capability: arranha-teia
objective: add-wall-climb
summary: Acrescenta ao Arranha-Teia um estado de agarre à parede. Ao estar em contato com a fachada de um prédio, abrir as mãos agarra a parede; descer uma mão por vez (ou as duas) sobe, as duas mãos subindo juntas descem (como o Homem-Aranha). O punho fechado segurado solta da parede. A lógica nova é pura no pacote @guess-my-move/swing (estado de agarre no SwingState, entradas de agarre/escalada/soltura no SwingInput, máquina de estados provada por teste de propriedade a sair do agarre em tempo finito) e um gesto puro e testado que converte os landmarks de cada mão num sinal de escalada. A camada web integra no SwingController com regra de precedência da palma aberta (agarra com contato, solta a teia sem contato), teclas alternativas (V agarra, setas sobem/descem), HUD, guia e painel de depuração. Nenhuma precisão ou desempenho é afirmado sem medição; os testes usam dados sintéticos. Gates 1 e 2 aprovados antecipadamente pelo maintainer em 2026-10-29; Gate 3 fica pendente do teste ao vivo. Emenda CQ-010 (2026-10-30) refez a escalada e a soltura após a revisão do dono.
status: implementing
owners:
    - wezercarvalho
reviewers:
    - kirocrew
aliases:
    - escalar
    - escalada
    - agarrar
    - agarre
    - parede
    - fachada
    - wall climb
    - Homem-Aranha
    - palma aberta
    - punho solta
    - soltar da parede
    - packages/swing
    - climb.ts
    - swingController.ts
code_paths:
    - packages/swing/
    - apps/web/
related_specs:
    - 2026-10-28-game-arranha-teia-build-first-person-web-swing
supersedes: []
branch: feat/81-escalar-paredes
constitution_version: 1.0.0
created_at: 2026-10-29
updated_at: 2026-10-29
---

# Escalar paredes no Arranha-Teia agarrando com as mãos abertas

## Resumo

Esta mudança acrescenta ao Arranha-Teia (spec `2026-10-28-game-arranha-teia-build-first-person-web-swing`, aqui citada como contexto, não reescrita) um estado novo de **agarre à parede**. Hoje, ao bater num prédio com a teia presa, o jogador desliza pela fachada com atrito e continua preso à teia (CQ-008); não há como escalar. O maintainer quer que, em contato com a parede, abrir as mãos grude o jogador na fachada e que, descendo uma mão por vez, ele suba (ou desça, com as duas mãos subindo juntas) a parede, como o Homem-Aranha; o punho fechado solta da parede (CQ-010).

A lógica nova é pura e vive no pacote `@guess-my-move/swing`, com teste antes do código. O estado do jogador ganha um campo de agarre (`grip`); a entrada por passo (`SwingInput`) ganha o pedido de agarrar por mão, um sinal de escalada (deslocamento vertical) e o sinal de soltar (punho fechado). Enquanto agarrado, o jogador fica colado à parede (sem gravidade, sem deslizar) e sobe ou desce ao longo dela com velocidade proporcional ao movimento das mãos, limitada; ao chegar ao topo do prédio, sai para o telhado. Uma máquina de estados pequena (entrada → subida/descida → saída) é provada por teste de propriedade: em qualquer sequência de entradas, o jogador deixa o estado agarrado em tempo finito, sem reiniciar.

O gesto é outro módulo puro e testado: converte os landmarks das mãos num sinal de escalada (cada mão que desce na imagem puxa o corpo para cima, as duas subindo juntas descem — medido pelo deslocamento vertical dos pulsos entre quadros, com zona morta e limites) e, para soltar, lê o punho fechado de alguma mão (CQ-010; o sinal de profundidade `z` foi removido por ser estruturalmente ~0 no MediaPipe). Nenhuma precisão é afirmada; os testes usam dados sintéticos, declarados como tais. A camada web integra tudo no `SwingController`: a precedência da palma aberta (com contato agarra, sem contato solta a teia como hoje), as teclas alternativas, o HUD, o guia e o painel de depuração. O fluxo de teia por mão (CQ-009) não regride.

Os Gates 1 e 2 foram aprovados antecipadamente pelo maintainer em 2026-10-29 ("Pode implementar cada um. Abre os PRs separados para cada Issue e me avisa quando tu terminar todos e eu puder testar."). O Gate 3 fica pendente do teste ao vivo do maintainer; a spec permanece em `implementing`.

## Problema

O Arranha-Teia já resolve o balanço por teia e o deslize pela parede, mas o contato com a fachada é um beco sem ação: o jogador desliza com atrito e só pode soltar a teia ou lançar outra. Não existe nenhuma forma de **ficar** na parede e subir por ela com as mãos, que é o que a issue #81 pede. Isso exige três coisas que o jogo ainda não tem:

1. Um **estado de agarre** na física pura, que só começa com contato com a parede e o gesto de agarrar, cola o jogador à fachada (sem gravidade e sem deslizar) e o move ao longo dela.
2. Um **gesto de escalada** derivado dos landmarks: o deslocamento vertical de cada mão (descer sobe; as duas subindo juntas desce) e o gesto de soltar (punho fechado), com os dados ruidosos e aproximados de uma webcam.
3. Uma **regra de precedência**: a palma aberta hoje solta a teia (`Open_Palm`, CQ-008); com contato com a parede ela precisa, em vez disso, agarrar. Sem essa regra os dois significados colidem.

O risco maior não é desenhar o movimento, e sim **não prender o jogador**. Um estado de agarre mal feito trava o jogador na parede sem saída (ruído do rastreio, perda momentânea das mãos, canto de prédio). A spec precisa garantir, por construção e por teste de propriedade, que sempre há saída: pelo gesto de soltar, por perder as mãos além de uma tolerância, por lançar uma teia, por chegar ao topo, e por uma tecla — e que nenhuma sequência de entradas prende o jogador para sempre.

A tentativa original de distinguir "puxar a mão para trás" pela profundidade `z` do MediaPipe não se sustentou: o `z` tem origem no pulso e fica ~0 (CQ-010), então o sinal era inoperante. A soltura passou a ser o punho fechado segurado por tempo — um gesto robusto — e nunca é a única saída. A referência visual (Homem-Aranha) é só inspiração de forma: nenhuma marca ou personagem de terceiros aparece em arquivo nenhum.

## Objetivos

- Acrescentar um estado de agarre à parede na física pura do `@guess-my-move/swing`, que só começa com contato com a parede mais o gesto de agarrar, cola o jogador à fachada (sem gravidade, sem deslizar) e o move verticalmente ao longo dela com velocidade proporcional ao movimento, limitada.
- Garantir, por construção e por teste de propriedade, que o jogador sai do estado agarrado em tempo finito em qualquer sequência de entradas, sem reiniciar: pelo gesto de soltar, por perder as mãos além de uma tolerância, por lançar uma teia, por chegar ao topo (vira telhado) e por uma tecla.
- Converter, num módulo puro e testado, os landmarks das mãos num sinal de escalada (descer uma mão por vez sobe; as duas subindo juntas desce — pelo deslocamento vertical dos pulsos entre quadros, com zona morta e limites) e ler o punho fechado como soltura, sem afirmar precisão e usando dados sintéticos nos testes.
- Resolver o conflito do gesto da palma aberta: com contato com a parede ela agarra; sem contato ela solta a teia como hoje.
- Integrar na camada web (SwingController, HUD, guia, dicas e painel de depuração) com teclas alternativas de teste, mantendo o fluxo de teia por mão (CQ-009) sem regressão.
- Entregar test-first, com os gates oficiais verdes, e registrar a verificação (pilotos automáticos e Chromium headless) como texto, sem afirmar desempenho sem medição.

## Fora de escopo

- Escalar telhados, beirais, vãos entre prédios ou cantos externos: o agarre vale na fachada de um prédio; chegar ao topo encerra o agarre no telhado, mas não há escalada de topo nem de vão.
- Animação de personagem, braços ou mãos desenhados na cena: o agarre muda a física e o HUD, não a renderização de um avatar.
- Qualquer mudança da pose de teia, do balanço, da mira assistida, da física do voo livre ou do pipeline de dados da cidade: esta entrega só acrescenta o agarre e a regra de precedência da palma aberta.
- Movimento horizontal lateral ao longo da parede: o agarre sobe e desce; não anda de lado pela fachada.
- Medir ou afirmar precisão do sinal de profundidade, taxa de acerto do gesto, fps, latência ou suavidade: os valores são de jogo e o que não for medido fica declarado como pendente.
- Marca, personagem, textura ou som de terceiros: a referência ao Homem-Aranha é só inspiração de forma e não aparece em arquivo nenhum.

## Atores

- **Jogador com câmera:** em contato com a parede, abre as mãos para agarrar; move as mãos alternadamente para subir ou descer; puxa a mão para trás para soltar; lê o HUD ("Agarrado").
- **Jogador com teclado:** em contato com a parede, segura `V` para agarrar e usa as setas para cima/baixo para subir/descer; solta `V` para largar.
- **Maintainer:** aprovou a intenção e o escopo (Gates 1 e 2) e testará a tela ao vivo (Gate 3 pendente).
- **Pessoa que usa teclado para navegar a interface:** alcança as dicas, o guia e o painel de depuração com foco visível e ordem previsível.

## Histórias de usuário

### US-001 — Agarrar a parede com as mãos abertas (P1)

Como jogador em contato com a fachada de um prédio, quero abrir as mãos para grudar na parede, para parar de deslizar e poder escalar.

**Teste independente:** colocar o jogador em contato com a parede e pedir o agarre (palma aberta ou `V`); o jogador cola na fachada, para de cair e de deslizar, e o HUD mostra "Agarrado". Sem contato com a parede, o mesmo gesto não agarra (a palma aberta segue soltando a teia).

**Critérios de aceitação:**

1. **Dado** o jogador em contato com uma parede, **quando** pede o agarre, **então** ele cola na fachada (sem gravidade e sem deslizar) e entra no estado agarrado.
2. **Dado** o jogador sem contato com parede, **quando** abre as mãos, **então** nenhum agarre acontece e a palma aberta continua só soltando a teia.

### US-002 — Subir e descer movendo as mãos (P1)

Como jogador agarrado, quero mover as mãos alternadamente para subir (ou descer) a fachada, para escalar o prédio.

**Teste independente:** com o jogador agarrado, aplicar um sinal de escalada positivo (uma mão desce enquanto a outra sobe) e ver a altura aumentar com velocidade proporcional e limitada; aplicar o sinal oposto e ver a altura diminuir; sinal nulo mantém a altura.

**Critérios de aceitação:**

1. **Dado** o jogador agarrado, **quando** o sinal de escalada é positivo, **então** ele sobe pela fachada com velocidade proporcional ao sinal e limitada ao máximo de jogo.
2. **Dado** o jogador agarrado, **quando** o sinal é negativo (e permitido descer), **então** ele desce pela fachada; com sinal nulo a altura não muda.

### US-003 — Soltar da parede com um gesto claro (P1)

Como jogador agarrado, quero fechar o punho para soltar da parede e voltar à física normal, para seguir o passeio.

**Teste independente:** com o jogador agarrado, fechar o punho e segurá-lo por tempo (`fistReleaseMs`); o agarre termina e o jogador volta à física normal (gravidade, voo livre).

**Critérios de aceitação:**

1. **Dado** o jogador agarrado, **quando** o punho fechado é segurado além do tempo, **então** o agarre termina e a física normal volta a agir.

### US-004 — Nunca ficar preso na parede (P1)

Como jogador, quero a garantia de que o agarre nunca me prende sem saída, para o passeio ser sempre contínuo.

**Teste independente:** colocar o jogador agarrado e aplicar sequências de entrada quaisquer (incluindo deixar de pedir o agarre, perder as mãos, lançar uma teia, deixar de pedir o agarre e chegar ao topo); em todas elas o jogador sai do agarre em um número finito de passos, sem reiniciar.

**Critérios de aceitação:**

1. **Dado** o jogador agarrado, **quando** deixa de pedir o agarre (gesto some, mãos perdidas além da tolerância, ou tecla solta), **então** ele solta sozinho.
2. **Dado** o jogador agarrado, **quando** chega ao topo do prédio, **então** sai da parede e fica em pé no telhado.
3. **Dado** o jogador agarrado, **quando** lança uma teia, **então** o agarre termina e a teia passa a valer.
4. **Dado** o jogador agarrado e parado, **quando** segue segurando o agarre (mão aberta ou tecla), **então** continua agarrado sem limite de tempo (admirar a paisagem); a saída continua sempre à mão: abrir mão do pedido, o punho ou lançar uma teia.

### US-005 — Guia, dicas e depuração do agarre (P2)

Como jogador, quero ver na tela o estado "Agarrado", uma dica curta de como escalar e soltar, e os números do gesto no painel de depuração, para entender e ajustar o controle.

**Teste independente:** com o jogador agarrado, o HUD mostra "Agarrado"; a dica diz como subir e soltar; o painel de depuração mostra o sinal de escalada e o de soltar por mão.

**Critérios de aceitação:**

1. **Dado** o jogador agarrado, **quando** a tela atualiza, **então** o medidor de estado mostra "Agarrado" e a dica explica, em uma linha, como subir e como soltar.
2. **Dado** o painel de depuração aberto, **quando** as mãos estão à vista, **então** ele mostra, por mão, a palma aberta e o punho, e globalmente o contato com a parede, o agarre e o sinal de escalada.

## Requisitos funcionais

- **FR-001:** O estado do jogador (`SwingState`) DEVE ganhar um campo de agarre à parede (`grip`), nulo fora do agarre. O agarre só DEVE começar quando houver contato com uma parede (um `Contact` de `kind` diferente de `roof`) no passo e o jogador pedir o agarre (`grab`) em pelo menos uma mão. Ao agarrar, a velocidade DEVE ser zerada, a gravidade e o deslize DEVEM deixar de agir, e as teias presas DEVEM ser soltas (para a corda não puxar o jogador para fora da parede; decisão registrada em `clarification.md`). Sem contato com parede não HÁ agarre.
- **FR-002:** A entrada por passo (`SwingInput`) DEVE ganhar: o pedido de agarrar por mão (`grab: SlotFlags`), um sinal de escalada numérico (`climb`, de -1 a 1) e o sinal de soltar da parede (`releaseFist`, booleano — o punho fechado de alguma mão). O sinal de escalada (CQ-010) DEVE ser: cada mão que DESCE na imagem puxa o corpo para cima (`up = max(0,dyEsq) + max(0,dyDir)`), as DUAS mãos subindo juntas descem (`down = min(max(0,-dyEsq), max(0,-dyDir))`), `climb = clamp(up - down)` com zona morta e saturação; uma mão ausente conta `dy = 0`. Enquanto agarrado, o jogador DEVE subir ou descer ao longo da normal vertical da parede com velocidade `climb * climbSpeed`, limitada a `climbSpeed` (valor de jogo), colado à fachada (a colisão da parede continua a resolver a posição horizontal). Descer DEVE ser permitido (`climb` negativo); `climb` nulo mantém a altura. Alternar as mãos DEVE dar subida líquida positiva (testado explicitamente).
- **FR-003:** O agarre DEVE terminar (voltando à física normal, com `grip` nulo) em QUALQUER uma destas condições, garantindo saída em tempo finito: (a) o jogador deixa de pedir o agarre (`grab` vazio) por mais que a tolerância de perda curta da mão/palma (`grabGraceMs`, valor de jogo), OU fecha o punho (`releaseFist`) e o segura por `fistReleaseMs`; (b) o jogador lança uma teia (há teia presa no passo); (c) o jogador chega ao topo do prédio (a altura do agarre passa da altura do prédio em contato), caso em que ele sai para o telhado e fica em pé (`grounded`). Não há saída por inatividade (removida na CQ-011): segurar o pedido de agarre é um pedido deliberado de ficar. A tolerância `grabGraceMs` evita soltar por um único quadro ruim no meio da escalada. O teste de propriedade DEVE provar que, para qualquer sequência de entradas, o jogador deixa o estado agarrado em um número finito de passos.
- **FR-004:** Um módulo puro e testado (`climb.ts`) DEVE converter os landmarks das mãos num sinal de escalada: para cada mão, o deslocamento vertical de um ponto de referência (o pulso) entre dois quadros consecutivos; cada mão que desce na imagem puxa o corpo para cima (`up`), as duas subindo juntas descem (`down`), e `climb = clamp(up - down)` com zona morta e saturação, devolvendo um escalar de -1 a 1 (CQ-010). O sinal de soltar da parede é o **punho fechado** (`isFist`) de alguma mão, segurado por tempo no passo do agarre — o sinal de profundidade `z` foi REMOVIDO por ser estruturalmente ~0 no MediaPipe (origem do `z` no pulso). Essas funções DEVEM ser puras, sem estado global, e NÃO DEVEM afirmar precisão; os testes usam dados sintéticos e declaram isso.
- **FR-005:** A regra de precedência da palma aberta DEVE ser: com contato com a parede (o jogo sabe que o jogador está encostado), a palma aberta AGARRA; sem contato, a palma aberta SOLTA a teia como hoje. A pose de teia continua lançando a teia e o punho continua puxando; o agarre não muda esses gestos. A regra DEVE ser aplicada na camada web (`SwingController`), que conhece o contato pelo estado do mundo.
- **FR-006:** O `SwingController` DEVE integrar o agarre: ler o sinal de escalada (deslocamento vertical dos pulsos) e o de soltar (punho fechado) das mãos (via `climb.ts`/`isFist`), alimentar o `SwingInput` com `grab`, `climb` e `releaseFist`, e oferecer teclas alternativas de teste — `V` agarra (enquanto segurada) e as setas para cima/baixo sobem/descem (reaproveitando os eixos já existentes quando agarrado). As teclas e a precedência DEVEM ser documentadas no guia. As mudanças em `swingController.ts`, `world.ts` e `SwingScreen.tsx` DEVEM ser pequenas e localizadas, com o máximo da lógica nova em arquivos novos.
- **FR-007:** A tela DEVE refletir o agarre: o medidor de estado da teia DEVE mostrar "Agarrado" quando `grip` não é nulo; o guia e a linha de status DEVEM ter textos curtos para a nova mecânica — encostado sem agarre: "Parede: abra a mão para agarrar." (mantida ~600 ms no controlador para não piscar), agarrado: "Agarrado. Desça uma mão por vez para subir. Punho solta." —, com uma 5ª etapa de parede no guia e dica de correção quando a palma some; e o painel de depuração DEVE mostrar, por mão, a palma aberta e o punho, e globalmente o contato com a parede, o agarre e o sinal de escalada. Os textos DEVEM ser curtos e objetivos.
- **FR-009 (CQ-011):** No modo Rosto, com rosto à vista e o neutro calibrado, agarrado, segurar o olhar para CIMA (ou para BAIXO) por `dwellMs` (2 s, valor de jogo) DEVE começar a subir (ou descer) enquanto o olhar for mantido; olhar para o LADO (guinada além de `yawLimit`) ou voltar ao centro DEVE parar na hora, e retomar exige repetir a espera. A lógica é pura e testada (`headClimb.ts`: espera, histerese entre `pitchStart` e `pitchHold`, parada lateral, `speed` da escalada). Combina com o sinal das mãos e as setas pelo maior módulo. Em Automática (sem rosto) o recurso não age. A linha de status mostra a direção e o tempo que falta, e, escalando, como parar; a depuração mostra a direção e o progresso.
- **FR-008:** O fluxo de teia por mão (CQ-009) NÃO DEVE regredir: os testes existentes de `twoWebs`, `moves`, `sides` e `swingHands` DEVEM continuar passando, e o agarre só age quando pedido com contato de parede, sem alterar o comportamento de lançar, segurar, puxar e soltar teias quando não há agarre.

## Requisitos não funcionais

- **NFR-001:** A lógica nova (estado de agarre na física, módulo de gesto `climb.ts`) DEVE ser test-first: o teste é escrito e visto falhar antes da implementação; as funções são puras e sem dependência de navegador ou câmera.
- **NFR-002:** Os gates oficiais DEVEM ficar verdes ao fim: `yarn check:all`, `yarn test:gates`, `yarn test:sdd`, `yarn sdd:check`, `yarn docs:format:check` e `yarn security:dependencies`; nenhuma dependência nova é adicionada.
- **NFR-003:** Nenhuma afirmação de precisão do gesto, de profundidade, de fps ou de latência DEVE ser feita sem medição registrada; os valores de agarre (`climbSpeed`, zona morta, tolerâncias e tempos do olhar) são de jogo e declarados como tais.
- **NFR-004:** A verificação em Chromium headless DEVE ser registrada como TEXTO (sem salvar imagens no repositório); nenhuma requisição DEVE ir a domínio de terceiros; o processamento da câmera continua local, sem gravar nem enviar imagem.
- **NFR-005:** Dois pilotos automáticos descartáveis na cidade real (`apps/web/public/swing/midtown.json`, pacote `swing`) DEVEM ser executados e registrados como texto: um que lança a teia, bate na fachada, agarra e sobe até o topo; outro que tenta sequências aleatórias de entradas e prova que o jogador nunca fica preso no agarre.

## Edge cases

- **Sem contato com parede:** o pedido de agarre não faz nada; a palma aberta segue soltando a teia.
- **Mãos somem no quadro:** o controlador para de pedir o agarre; a física solta sozinha quando `grab` fica vazio (saída por FR-003a).
- **Uma mão só:** o sinal de escalada alternado fica fraco ou nulo; o jogador pode agarrar (uma palma aberta basta) mas sobe devagar ou fica parado; segue agarrado enquanto a mão segurar, e a saída por punho ou por soltar o pedido continua disponível.
- **Canto de prédio / contato intermitente:** a colisão da parede continua resolvendo a posição; se o contato some por um passo, o agarre persiste enquanto `grab` for pedido, mas a saída por `grab` vazio e o punho garantem que não prende.
- **Topo / telhado:** ao passar da altura do prédio em contato, o agarre termina e o jogador fica em pé no telhado (`grounded`).
- **Jogador no chão:** sem parede acima do chão não há contato de parede, então não agarra; o comportamento de chão (corrida automática sem teia) não muda.
- **Duas mãos agarrando:** basta uma palma aberta para agarrar; as duas aumentam o sinal de escalada alternado, não criam um segundo agarre.
- **Soltar da parede (punho):** o sinal de soltar é o punho fechado segurado por tempo (`fistReleaseMs`); nunca é a única saída (há perder o agarre além da tolerância, teia e topo). O sinal de profundidade `z` foi removido (CQ-010), por ser estruturalmente ~0 no MediaPipe.

## Hipóteses e dependências

- **H-01 (revista na CQ-010):** a hipótese original de usar o `z` do MediaPipe para "puxar a mão para trás" foi DESCARTADA — o `z` tem origem no pulso e fica ~0, então o sinal era código morto. Soltar passou a ser o punho fechado segurado por tempo (`isFist`, `fistReleaseMs`); o agarre mantém várias saídas que não dependem de medição não feita ao vivo.
- **H-02 (revista na CQ-010):** a escalada vem do deslocamento vertical de cada pulso: cada mão que desce na imagem puxa o corpo para cima (`up`), as duas subindo juntas descem (`down`), `climb = clamp(up - down)` com zona morta. Alternar as mãos dá subida líquida positiva (a fórmula antiga por diferença cancelava o movimento alternado). Testado com dados sintéticos, não ao vivo.
- **H-03:** O estado do mundo já expõe (ou pode expor de forma pequena) se o jogador está em contato com uma parede, de modo que o `SwingController` aplique a precedência da palma aberta sem reimplementar a colisão.
- **Dependências:** a física do Arranha-Teia e a colisão por `Contact` (`packages/swing`); o reconhecedor de mão e a leitura por quadro do `SwingController`; o design system para o HUD e o guia; os testes existentes de teia por mão, que não podem regredir.

## Critérios mensuráveis de sucesso

- **SC-001:** Os testes em Vitest do estado de agarre (entrada só com contato de parede, cola à fachada, sobe/desce com `climb`, saídas por `grab` vazio além da tolerância `grabGraceMs`, punho segurado `fistReleaseMs`, teia e topo; parado agarrado não solta) passam sem navegador, exercitando os valores fixados nos FRs.
- **SC-002:** Um teste de propriedade prova que, para muitas sequências aleatórias de entradas, o jogador sempre deixa o estado agarrado em um número finito de passos, sem reiniciar.
- **SC-003:** Os testes do módulo de gesto (`climb.ts`): o sinal de escalada é positivo quando uma mão desce (ou as mãos alternam), negativo quando as duas sobem juntas, nulo na zona morta e saturado no limite; a soltura dispara com o punho fechado segurado por tempo. Usam dados sintéticos, declarados como tais.
- **SC-004:** O `SwingController` com mãos simuladas e teclado agarra com contato de parede, sobe e desce, solta, e aplica a precedência da palma aberta (sem contato, solta a teia); os testes existentes de teia por mão continuam passando.
- **SC-005:** Os dois pilotos automáticos (subir até o topo; sequências aleatórias sem prender) e a verificação em Chromium headless (agarrar, subir, soltar; só requisições à própria origem; sem erros no console) estão registrados como texto em `validation.md`.
- **SC-006:** `yarn check:all`, `yarn test:gates`, `yarn test:sdd`, `yarn sdd:check`, `yarn docs:format:check` e `yarn security:dependencies` passam; nenhuma dependência nova é adicionada.
