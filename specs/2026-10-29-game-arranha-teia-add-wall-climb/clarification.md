# Clarificação — 2026-10-29-game-arranha-teia-add-wall-climb

## Contexto

- **Spec:** `spec.md`
- **Status de entrada:** `specified`
- **Status após o Gate 1:** `implementing`
- **Constituição:** `1.0.0`
- **Iniciada em:** `2026-10-29`

Esta clarificação registra as decisões de projeto do agarre à parede (issue #81) e o resultado das questões de clarificação. Os Gates 1 e 2 foram **aprovados antecipadamente** pelo maintainer em 2026-10-29 ("Pode implementar cada um. Abre os PRs separados para cada Issue e me avisa quando tu terminar todos e eu puder testar."). O Gate 3 **NÃO** está aprovado: fica pendente do teste ao vivo do maintainer. A spec permanece em `implementing`, com o Gate 3 pendente; a implementação é test-first e a validação segue ao fim. Todas as questões abaixo estão **RESOLVIDAS**.

### Decisões já fixadas pela issue #81 (usadas como fatos)

- **D-01 — Mecânica:** em contato com a parede, abrir as mãos agarra a fachada; mover as mãos alternadamente sobe (ou desce); puxar a mão para trás solta. Incorporada em US-001, US-002, US-003, FR-001, FR-002.
- **D-02 — Anti-bug:** sem contato com a parede não há agarre; sem mãos por mais que a tolerância solta; existe sempre ao menos uma saída por gesto e uma por tecla; o jogador nunca fica sem poder se mover. Incorporada em US-004, FR-003.
- **D-03 — Fora de escopo:** escalar telhados e vãos, animação de personagem e qualquer mudança da pose de teia. Incorporada em Fora de escopo.
- **D-04 — Sem terceiros:** a referência ao Homem-Aranha é só inspiração de forma; nenhuma marca ou personagem aparece em arquivo nenhum. Incorporada em Fora de escopo, FR-007.

## Log de decisões

### CQ-001 — Conflito do gesto da palma aberta (agarrar vs soltar a teia)

- **Data:** `2026-10-29`
- **Impacto:** alto
- **Pergunta:** A palma aberta já solta a teia (`Open_Palm`, CQ-008). Com o agarre, a palma aberta precisa agarrar a parede. Qual é a regra de precedência?
- **Decisão:** **RESOLVIDA** — recomendação da issue adotada: **com contato com a parede, a palma aberta agarra; sem contato, a palma aberta solta a teia como hoje.** A regra é aplicada na camada web (`SwingController`), que conhece o contato pelo estado do mundo (a física expõe se o jogador está encostado numa parede). A pose de teia continua lançando e o punho continua puxando; o agarre não muda esses gestos.
- **Razão:** é a regra mais simples e previsível e evita um gesto novo: o contato com a parede desambigua o significado da palma. O jogador só pode agarrar quando faz sentido (encostado), e longe da parede a palma mantém o comportamento conhecido de soltar a teia.
- **Alternativas rejeitadas:** criar um gesto novo só para agarrar (aumenta a carga de gestos e o reconhecimento é frágil); inverter (palma solta a teia mesmo encostado e um gesto separado agarra) — contraria o pedido do maintainer e deixa o agarre sem gatilho natural.
- **Seções atualizadas em `spec.md`:** FR-005, US-001.

### CQ-002 — O que acontece com a teia ao agarrar

- **Data:** `2026-10-29`
- **Impacto:** médio
- **Pergunta:** Ao agarrar a parede, as teias presas ficam presas ou soltam?
- **Decisão:** **RESOLVIDA** — ao agarrar, **as teias presas são soltas**. No agarre, a física da corda deixa de agir; manter a corda presa competiria com o agarre (a corda puxaria o jogador para o ponto de ancoragem, tirando-o da parede ou prendendo-o em dois regimes ao mesmo tempo).
- **Razão:** é o que evita travar o jogador: um único regime age por vez (ou balanço de corda, ou agarre colado à parede). Soltar as teias ao agarrar deixa a saída do agarre limpa (lançar uma teia recomeça o balanço) e impede a corda de arrancar o jogador da fachada.
- **Alternativas rejeitadas:** manter as teias presas durante o agarre (dois regimes competindo; risco de o jogador ser puxado para fora da parede ou de um estado ambíguo); manter presas mas sem assistência (complexidade sem ganho; ainda limitaria a posição pela corda).
- **Seções atualizadas em `spec.md`:** FR-001, FR-003 (lançar uma teia encerra o agarre).

### CQ-003 — Qual sinal mensurável significa "soltar da parede"

- **Data:** `2026-10-29`
- **Impacto:** alto
- **Pergunta:** "Puxar a mão para trás" é ambíguo. Qual sinal dos landmarks significa soltar da parede: afastar a mão da câmera (profundidade `z`), baixar a mão rápido, ou fechar o punho?
- **Decisão:** **RESOLVIDA** — o sinal escolhido é **afastar a mão da câmera** (aumento da profundidade `z` do MediaPipe além de um limite, medido como a variação de `z` do pulso entre quadros). Esse é o significado literal de "puxar a mão para trás" e não colide com os outros sinais (baixar a mão é parte do movimento de escalada; fechar o punho já puxa a teia). **Mas ele NUNCA é a única saída:** o agarre também termina quando o jogador deixa de pedir o agarre (gesto some, mãos perdidas além da tolerância, tecla solta), quando lança uma teia, quando chega ao topo (vira telhado) e quando fica sem movimento de escalada por mais que a tolerância. O `z` do MediaPipe é aproximado e **não foi medido ao vivo** — declarado como hipótese (H-01).
- **Razão:** o afastamento da mão é o gesto que o maintainer descreveu e é o único dos três que não conflita com a escalada (que usa o deslocamento vertical) nem com o puxão da teia (punho). Como é aproximado, o projeto garante várias saídas robustas que não dependem dele, atendendo à exigência anti-bug.
- **Alternativas rejeitadas:** baixar a mão rápido (confunde-se com o movimento de descer na escalada); fechar o punho (já tem significado — puxar a teia); depender só do `z` (frágil, por isso há as outras saídas).
- **Seções atualizadas em `spec.md`:** FR-003, FR-004, H-01.

### CQ-004 — Como medir o movimento de escalada

- **Data:** `2026-10-29`
- **Impacto:** médio
- **Pergunta:** Como converter o movimento das mãos num sinal de subir/descer?
- **Decisão:** **RESOLVIDA** — a escalada vem do **movimento alternado**: para cada mão, mede-se o deslocamento vertical de um ponto de referência (o pulso) entre dois quadros consecutivos; quando uma mão desce enquanto a outra sobe (deslocamentos de sinais opostos), há escalada para cima proporcional à amplitude; o sentido segue o da mão que **desce** (puxar o corpo para cima), com zona morta (ruído não conta) e saturação (limite). O resultado é um escalar de -1 a 1 (`climb`), já reduzido no módulo puro `climb.ts`. Com uma mão só, o sinal alternado é fraco ou nulo; a tolerância de inatividade solta depois de um tempo.
- **Razão:** o movimento alternado é o gesto natural de escalar (como o Homem-Aranha "puxa" o corpo) e distingue-se do movimento conjunto pelo produto dos deslocamentos (sinais opostos). A zona morta protege do ruído do rastreio; a saturação limita a velocidade. Reduzir a um escalar mantém a física pura e simples.
- **Alternativas rejeitadas:** usar o movimento de uma mão só (não é "alternar"; confunde com descer); usar a posição absoluta das mãos (deriva com o enquadramento); velocidade de escalada já em metros (acopla o gesto à física; o escalar normalizado é mais testável).
- **Seções atualizadas em `spec.md`:** FR-002, FR-004.

### CQ-005 — Velocidade máxima de subida e se também desce

- **Data:** `2026-10-29`
- **Impacto:** baixo
- **Pergunta:** Qual a velocidade máxima de escalada e o jogador também desce?
- **Decisão:** **RESOLVIDA** — a escalada **sobe e desce** (o `climb` negativo desce), com velocidade `climb * climbSpeed`, limitada a `climbSpeed` (um valor de jogo, não realista, ajustável sem mudar a arquitetura). Descer permite recuar de um topo ruim ou reposicionar sem soltar; não há alvo de realismo nem de desempenho.
- **Razão:** permitir descer dá controle sem custo de complexidade e é uma saída extra (descer até o chão sai do contato de parede). O valor é de jogo porque não há referência física nem medição.
- **Alternativas rejeitadas:** só subir (menos controle, e o jogador poderia querer recuar); velocidade realista (sem base de medição e sem valor para a sensação).
- **Seções atualizadas em `spec.md`:** FR-002, NFR-003.

### CQ-006 — Teclas alternativas para teste

- **Data:** `2026-10-29`
- **Impacto:** baixo
- **Pergunta:** Quais teclas controlam o agarre sem a câmera?
- **Decisão:** **RESOLVIDA** — **`V` agarra** (enquanto segurada, com contato de parede) e as **setas para cima/baixo** sobem/descem (os mesmos eixos já lidos pelo controlador, reaproveitados como `climb` quando agarrado). Soltar `V` solta o agarre (saída por `grab` vazio). As teclas são documentadas no guia e nas dicas.
- **Razão:** reaproveitar as setas de olhar como escalada quando agarrado evita teclas novas e é previsível (para cima sobe); `V` é uma tecla livre e próxima das demais (Z, X, C). Soltar a tecla é a saída por teclado exigida pela issue.
- **Alternativas rejeitadas:** criar teclas dedicadas de subir/descer (desnecessário; as setas servem); usar Espaço (já lança a teia do centro).
- **Seções atualizadas em `spec.md`:** FR-006.

## Hipóteses remanescentes

- **H-01:** O `z` dos landmarks do MediaPipe (profundidade relativa) é suficiente para detectar "puxar a mão para trás" como um aumento além de um limite. É aproximado e **não foi medido ao vivo**; por isso o sinal de soltar nunca é a única saída do agarre (há `grab` vazio, inatividade, teia e topo).
- **H-02:** O movimento alternado das mãos (uma sobe, outra desce) distingue-se do movimento conjunto pelo sinal do produto dos deslocamentos verticais; com zona morta, o ruído do rastreio não dispara escalada. Testado só com dados sintéticos.
- **H-03:** O estado do mundo expõe (ou pode expor de forma pequena) se o jogador está em contato com uma parede no último passo, de modo que o `SwingController` aplique a precedência da palma aberta sem reimplementar a colisão.
- Os valores de agarre (`climbSpeed`, zona morta, `gripIdleMs`, limite de profundidade) são de jogo, ajustáveis sem mudar a arquitetura; não há alvo de realismo nem de fps (NFR-003).
- Nada foi verificado ao vivo com a mão real nem numa GPU real; a sensação do agarre e da escalada depende do teste do maintainer (Gate 3 pendente).

## Questões resolvidas na aprovação da clarificação

Todas as questões abaixo foram decididas na aprovação antecipada da clarificação (2026-10-29), pelas recomendações registradas acima:

- **CQ-001** — com contato com a parede a palma aberta agarra; sem contato, solta a teia.
- **CQ-002** — ao agarrar, as teias presas são soltas (um regime por vez, evita travar).
- **CQ-003** — soltar = afastar a mão da câmera (profundidade `z`), nunca a única saída.
- **CQ-004** — a escalada vem do movimento alternado (deslocamento vertical de cada pulso), com zona morta e saturação, reduzido a um escalar `climb`.
- **CQ-005** — sobe e desce, velocidade `climb * climbSpeed` limitada; valor de jogo.
- **CQ-006** — `V` agarra, setas para cima/baixo sobem/descem; soltar `V` solta.

## Gate 1 — Clarificação aprovada

- **Status:** aprovado
- **Aprovador:** wezercarvalho (maintainer)
- **Data:** `2026-10-29`
- **Artefatos aprovados:** `spec.md`, `clarification.md`
- **Referência:** issue 81 do repositório (ver `spec.md`); mensagem do maintainer na sessão de 2026-10-29 ("Pode implementar cada um. Abre os PRs separados para cada Issue e me avisa quando tu terminar todos e eu puder testar."), aprovando antecipadamente os Gates 1 e 2.
- **Observações:** aprovação antecipada no chat. CQ-001 a CQ-006 ficam RESOLVIDAS pelas recomendações. A spec avança para `implementing` com `plan.md` e `tasks.md`. Pendências de medição mantidas e declaradas: o sinal de profundidade do MediaPipe é aproximado e não medido ao vivo; nada foi testado com a mão real; a sensação da escalada e os valores de jogo não foram medidos. O **Gate 3 NÃO está aprovado**: fica pendente do teste ao vivo do maintainer, e a spec permanece em `implementing`.
