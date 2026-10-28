# Clarificação — 2026-10-28-game-arranha-teia-build-first-person-web-swing

## Contexto

- **Spec:** `spec.md`
- **Status de entrada:** `specified`
- **Status após o Gate 1:** `implementing`
- **Constituição:** `1.0.0`
- **Iniciada em:** `2026-10-28`

Esta clarificação registra as decisões do maintainer na sessão de 2026-10-28 (como fatos) e o resultado das questões de clarificação. Os Gates 1 e 2 foram **aprovados antecipadamente** pelo maintainer em 2026-10-28 ("considere os gates aprovados"), que aceitou as recomendações de CQ-001 a CQ-005; CQ-006 e CQ-007 são emendas de implementação registradas depois. Todas estão **RESOLVIDAS** abaixo. A spec avança para o planejamento técnico (`plan.md` e `tasks.md`) e para a implementação test-first; a validação (`validation.md`) e o Gate 3 seguem ao fim, depois do código e da verificação visual, com o risco aceito de não haver teste ao vivo com a mão.

### Decisões já tomadas pelo maintainer (2026-10-28, usadas como fatos)

- **D-01 — Nome:** o jogo chama-se **Arranha-Teia** (arranha-céu + teia). Incorporada no Resumo, no título e nos aliases.
- **D-02 — Cidade:** um trecho de **Midtown** Manhattan do OpenStreetMap, sob ODbL, com atribuição na tela. Incorporada em US-003, FR-001.
- **D-03 — Gesto:** o gesto **ILoveYou** lança a teia; sustentar mantém o balanço, desfazer solta. Incorporada em US-001, US-002, FR-005.
- **D-04 — Sem terceiros:** nenhuma marca, personagem, textura, fonte ou som de terceiros nos arquivos do repositório; a cena usa só geometria e texturas procedurais próprias. Incorporada em Fora de escopo, FR-007, FR-009.
- **D-05 — Mundo:** metros, Y para cima, para a frente é -Z, yaw 0 olha para -Z e yaw positivo vira para +X, pitch limitado a ±60°. Incorporada em FR-002, FR-006.

## Log de decisões

### CQ-001 — Three.js como dependência nova e sua versão

- **Data:** `2026-10-28`
- **Impacto:** alto
- **Pergunta:** A cena 3D pode acrescentar uma dependência nova e qual versão fixar?
- **Decisão:** **RESOLVIDA** — aprovada pelo maintainer em 2026-10-28. Usar **Three.js 0.186.0** (licença MIT) empacotado pelo Vite, sem CDN, como a única dependência nova; a versão é fixada exatamente.
- **Razão:** o Three.js reduz muito o esforço da renderização em primeira pessoa e sua licença MIT permite empacotar e redistribuir pelo app; a versão exata mantém a auditoria de dependências determinística.
- **Alternativas rejeitadas:** WebGL cru (muito esforço para o escopo); carregar o Three.js de um CDN (viola "sem requisição a terceiros").
- **Seções atualizadas em `spec.md`:** FR-007, NFR-002, NFR-004, H-03.

### CQ-002 — Qual cidade e qual trecho

- **Data:** `2026-10-28`
- **Impacto:** alto
- **Pergunta:** Qual cidade e qual recorte usar, e como representá-lo?
- **Decisão:** **RESOLVIDA** — aprovada pelo maintainer em 2026-10-28. Um trecho de ~0,9 km × 0,9 km de **Midtown** (bbox lat 40.7540..40.7620, lon -73.9900..-73.9805, centro perto da Times Square), em coordenadas locais planas (aproximação equirretangular em torno do centro) rotacionadas 29° para as avenidas correrem ao longo de Z, no formato JSON v1 de `packages/swing/src/city.ts`, versionado em `apps/web/public/swing/midtown.json`.
- **Razão:** Midtown dá uma malha densa de prédios altos ideal para o balanço; o formato plano em metros simplifica a física e o render; versionar o JSON evita requisição a terceiros em tempo de jogo.
- **Alternativas rejeitadas:** buscar OSM em tempo de jogo (viola a privacidade e a robustez); outra cidade (fora de escopo nesta entrega).
- **Seções atualizadas em `spec.md`:** FR-001, US-003.

### CQ-003 — Teclado como alternativa à mão

- **Data:** `2026-10-28`
- **Impacto:** médio
- **Pergunta:** O jogo precisa ser jogável sem câmera?
- **Decisão:** **RESOLVIDA** — aprovada pelo maintainer em 2026-10-28. O teclado é uma **alternativa completa** à mão: Espaço (segurar) lança e mantém a teia; as setas dão direção nas mesmas taxas máximas de guinada e inclinação.
- **Razão:** o teclado permite jogar e testar sem câmera e torna o jogo utilizável por quem não tem ou não quer usar a câmera, sem um caminho de controle paralelo divergente (as taxas são as mesmas).
- **Alternativas rejeitadas:** só câmera (exclui quem não tem câmera e dificulta o teste determinístico).
- **Seções atualizadas em `spec.md`:** US-006, FR-006, NFR-006.

### CQ-004 — Sem validação ao vivo com a mão antes do fecho

- **Data:** `2026-10-28`
- **Impacto:** médio
- **Pergunta:** A entrega exige um teste ao vivo com a mão real antes de fechar?
- **Decisão:** **RESOLVIDA** — aprovada pelo maintainer em 2026-10-28. A validação final é por testes puros, teste do conversor e verificação visual em Chromium headless (câmera simulada, WebGL por software), registrada como texto; **não há teste ao vivo com a mão real** antes do fecho, e o **Gate 3 é concedido com risco aceito**.
- **Razão:** o reconhecedor e a `CameraPanel` já são exercitados pelos outros jogos; a lógica do balanço é pura e testável; o risco residual (comportamento com mão real numa máquina com GPU) é aceito pelo maintainer.
- **Alternativas rejeitadas:** exigir teste manual com a mão antes do merge (atrasa sem reduzir o risco de forma proporcional, dado o reaproveitamento do reconhecedor).
- **Seções atualizadas em `spec.md`:** NFR-003, NFR-005, SC-003, SC-006.

### CQ-005 — Alvo de realismo e de desempenho

- **Data:** `2026-10-28`
- **Impacto:** baixo
- **Pergunta:** A física deve ser realista e há alvo de fps?
- **Decisão:** **RESOLVIDA** — aprovada pelo maintainer em 2026-10-28. Os valores são **de jogo, não realistas**, e **não há alvo de fps**; nenhuma afirmação de desempenho, suavidade ou realismo é feita sem medição numa GPU real, que não será feita antes do fecho.
- **Razão:** o foco é a sensação de passeio e balanço, não a simulação física; medir fps no headless (WebGL por software) não representaria uma GPU real, então não se afirma desempenho.
- **Alternativas rejeitadas:** mirar realismo físico (fora do escopo e sem valor para a experiência); afirmar fps a partir do headless (seria evidência desonesta).
- **Seções atualizadas em `spec.md`:** NFR-003, H-04, SC-006.

### CQ-006 — Ponto de partida e alcance da teia na altura inicial

- **Data:** `2026-10-28`
- **Impacto:** médio
- **Pergunta:** Onde o jogador nasce e como garantir que a primeira teia tenha onde prender, já que a mira assistida só prende em prédios pelo menos 8 m acima do jogador?
- **Decisão:** **RESOLVIDA** na validação (2026-10-28). O ponto de partida nasce a **y = 90 m** (o `spawnHeight` da spec), não no chão; e `findSpawn` passou a **preferir o primeiro ponto livre de onde a teia, lançada logo ao começar, alcança um prédio à frente** (usa `pickAnchor` com o pitch inicial), caindo no primeiro ponto livre quando nenhum alcança. Os Gates 1 e 2 seguem aprovados; esta é uma correção de implementação registrada antes do Gate 3.
- **Razão:** na verificação visual o jogador nascia no chão e, aos 90 m, a mira assistida (ponto válido >= 8 m acima do jogador) só prenderia em prédios acima de ~98 m. A distribuição de alturas do `midtown.json` é baixa (mediana 17,6 m, p90 61,9 m, máximo 366 m, 556 prédios), então a maioria dos pontos de partida não teria âncora à frente. Preferir um ponto de onde a teia alcança um prédio torna o primeiro balanço possível sem mudar os valores de jogo nem a regra do ponto válido.
- **Alternativas rejeitadas:** baixar o `minRise` da mira (mudaria a sensação do jogo e a regra fixada no FR-003); elevar artificialmente todas as alturas (falsearia os dados OSM); nascer no chão (contraria o `spawnHeight` = 90 m da spec).
- **Seções atualizadas em `spec.md`:** FR-002 (spawn), SC-001; `research.md` (distribuição de alturas e regra do spawn); `physics.ts`/`spawn.ts` no código.

### CQ-007 — Duas mãos, pose em qualquer orientação, imersão e dicas na tela

- **Data:** `2026-10-28`
- **Impacto:** médio
- **Pergunta:** depois de testar a versão anterior, o maintainer pediu que o jogo reconheça as **duas mãos** e a pose em **qualquer orientação** (a mão de lado: polegar, indicador e mindinho abertos, médio e anelar dobrados), e que a **mecânica de balançar como o Homem-Aranha** fique mais imersiva, com dicas na tela. Como atender sem mudar a arquitetura nem afirmar o que não foi medido?
- **Decisão:** **RESOLVIDA** (emenda de implementação, 2026-10-28). Registrada depois da autorização geral do maintainer; os Gates 1 e 2 seguem **aprovados** e o estado da spec continua `validated`; o Gate 3 continua **aprovado com risco aceito pelo merge**. Mudanças:
    1. **Duas mãos:** o reconhecedor passa a `numHands` 2 (`realTwoHandGestureLoader`, `HandTracker.detectAll`, usando até duas mãos). O lado vem da posição na tela espelhada (`handSide` em `packages/swing/src/pose.ts`). A mão **esquerda** lança a teia com desvio de **18°** à esquerda (`sideYaw`), a **direita** à direita, as **duas juntas** ao centro; passar a usar a outra mão lança uma teia nova do outro lado e encadeia balanços. O teclado espelha: **Espaço** centro, **Z** esquerda, **X** direita, setas olham. O lado é uma preferência: tenta o desvio inteiro, metade e o centro.
    2. **Pose geométrica (`isWebPose`):** medida só por distâncias entre landmarks, independente da orientação e de qual mão. Indicador e mindinho esticados (ponta/base a partir do pulso >= **1,5**), médio e anelar dobrados (<= **1,3**), polegar aberto (ponta a >= **0,6** da palma, medida a partir da base do indicador). Vale também o rótulo `ILoveYou` do reconhecedor com score >= **0,7** (`webSignal`). Os limiares são **palpites**, validados só com landmarks sintéticos girados (0, 45, 90, 180, 270 graus, espelhados), **não com mão real**.
    3. **Câmera mais imersiva:** a mão que faz a pose não gira a câmera; a outra mão gira (`steerFromHand`). Sem giro manual, a câmera passa a olhar aos poucos para onde o jogador se move (`headingFollow` 1,2 por s, velocidade horizontal mínima 8 m/s).
    4. **Mira e teia no céu:** `minRise` 8 -> **25 m** e `minHorizontal` 12 -> **30 m** (arcos maiores, em vez de bater na fachada). **Teia no céu** quando nenhum prédio é alcançável (ponto 60 m à frente e 70 m acima, só até 220 m de altura; `ActiveWeb.virtual`); prédio alcançável sempre tem preferência. A prévia da mira é projetada na tela para cada mão antes de lançar (anel dourado quando à vista, seta na borda quando fora do quadro, rótulos "esq." e "dir."). A corda sai do pulso do lado que lançou e ficou mais fina.
    5. **Área jogável (`playBounds`):** caixa dos prédios + **120 m**, nunca além dos limites do mapa, para o jogador não sair da área construída (antes a caixa do mapa ia a -1112 m em x).
    6. **Dicas e guia:** `swingCue` (start, swing, release, throw, low, ground) alimenta a linha de status de uma frase, o guia "Como jogar" de 4 etapas, dicas de pose e de teclado, o medidor "Teia: esquerda/direita/centro/solta" no HUD e um contorno dourado (soltar) ou vermelho (perto do chão) no palco. Soltar na subida do arco (velocidade horizontal >= 12 m/s e subindo) é o que lança o jogador para longe.
- **Razão:** reconhecer as duas mãos e a pose por geometria torna o gesto robusto a orientação e a qual mão, o desvio por lado e a troca de mão dão o encadeamento de balanços que faltava, e as dicas na tela mais a teia no céu e a área jogável menor tornam o primeiro balanço possível e a mecânica legível — tudo com valores de jogo e sem mudar a arquitetura.
- **Alternativas rejeitadas:** manter uma só mão e o rótulo `ILoveYou` do reconhecedor (não reconhecia a pose de lado nem encadeava lados); baixar o `minRise` abaixo de 25 m (a teia batia na fachada); exigir teste ao vivo com a mão real antes do fecho (contraria CQ-004, risco já aceito).
- **Seções atualizadas em `spec.md`:** FR-003 (mira e teia no céu), FR-005 (duas mãos, pose geométrica, lados), FR-006 (direção e acompanhamento da câmera); `plan.md` e `research.md` (duas mãos, pose, teia no céu, área jogável, dicas); `tasks.md` (T015 a T020); `validation.md` (seção da CQ-007). Código real: `packages/swing/src/pose.ts`, `cue.ts`, `web.ts`, `world.ts`, `physics.ts`, `cityIndex.ts`, `spawn.ts`; `apps/web/src/swing/swingController.ts`, `guide.ts`, `reticle.ts`, `cityRenderer.ts`, `SwingScreen.tsx`; `apps/web/src/tracker/mediapipeTracker.ts`.
- **Não verificado:** nenhuma mão real nem as duas mãos ao vivo; os limiares da pose, o desvio de 18°, a teia no céu, a sensação de balanço e a dificuldade; fps numa GPU real.

## Hipóteses remanescentes

- O reconhecedor do MediaPipe inclui a categoria `ILoveYou` e devolve um score por quadro, confirmado pelo modelo versionado (ver `research.md`); H-01.
- A consulta à Overpass para a bbox de Midtown devolve prédios e vias suficientes (resposta de teste com 569 prédios e 177 vias em `research.md`); a Overpass é usada só no pipeline de dados, nunca em tempo de jogo (H-02).
- O Three.js 0.186.0 (MIT) pode ser empacotado e redistribuído pelo app sem CDN (H-03).
- Os valores de física são de jogo e podem ser ajustados sem mudar a arquitetura; não há alvo de realismo nem de fps (H-04).
- Nada foi verificado ao vivo com a mão real nem numa GPU real; a aparência e o desempenho finais dependem do teste do maintainer (CQ-004, CQ-005).

## Questões resolvidas na aprovação da clarificação

Todas as questões abaixo foram decididas pelo maintainer na aprovação antecipada da clarificação (2026-10-28), pelas recomendações registradas acima:

- **CQ-001** — Three.js 0.186.0 (MIT) empacotado, sem CDN, única dependência nova.
- **CQ-002** — trecho de Midtown no formato JSON v1, versionado, rotacionado 29°.
- **CQ-003** — teclado como alternativa completa à mão, mesmas taxas.
- **CQ-004** — sem validação ao vivo com a mão; Gate 3 com risco aceito.
- **CQ-005** — valores de jogo, sem alvo de fps nem afirmação de desempenho.
- **CQ-006** — ponto de partida a y = 90 m e `findSpawn` preferindo um ponto de onde a teia alcança um prédio à frente (registrada na validação, antes do Gate 3).
- **CQ-007** — duas mãos e pose geométrica em qualquer orientação, teia por lado e troca de mão, teia no céu, mira projetada na tela, dicas e guia, área jogável reduzida (emenda de implementação; Gates 1 e 2 aprovados, estado `validated`, Gate 3 aprovado com risco aceito pelo merge).

## Gate 1 — Clarificação aprovada

- **Status:** aprovado
- **Aprovador:** wezercarvalho (maintainer)
- **Data:** `2026-10-28`
- **Artefatos aprovados:** `spec.md`, `clarification.md`
- **Referência:** issue 76 do repositório (ver `spec.md`); mensagem do maintainer na sessão do dashboard em 2026-10-28 ("considere os gates aprovados"), aprovando antecipadamente os Gates 1 e 2 e aceitando as recomendações de CQ-001 a CQ-005.
- **Observações:** aprovação antecipada no chat. CQ-001 a CQ-005 ficam RESOLVIDAS pelas recomendações. A spec avança para `implementing` com `plan.md` e `tasks.md`. Pendências de medição mantidas e declaradas: a aparência e o desempenho (fps) ao vivo numa GPU real não foram medidos e não há validação com mão real. O Gate 3 segue para o fim, após o código e a verificação visual registrada em `validation.md`, e será concedido com risco aceito.
