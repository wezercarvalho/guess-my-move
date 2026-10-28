# Clarificação — 2026-10-28-game-arranha-teia-build-first-person-web-swing

## Contexto

- **Spec:** `spec.md`
- **Status de entrada:** `specified`
- **Status após o Gate 1:** `implementing`
- **Constituição:** `1.0.0`
- **Iniciada em:** `2026-10-28`

Esta clarificação registra as decisões do maintainer na sessão de 2026-10-28 (como fatos) e o resultado das questões de clarificação. Os Gates 1 e 2 foram **aprovados antecipadamente** pelo maintainer em 2026-10-28 ("considere os gates aprovados"), que aceitou as recomendações de CQ-001 a CQ-005; todas estão **RESOLVIDAS** abaixo. A spec avança para o planejamento técnico (`plan.md` e `tasks.md`) e para a implementação test-first; a validação (`validation.md`) e o Gate 3 seguem ao fim, depois do código e da verificação visual, com o risco aceito de não haver teste ao vivo com a mão.

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

## Gate 1 — Clarificação aprovada

- **Status:** aprovado
- **Aprovador:** wezercarvalho (maintainer)
- **Data:** `2026-10-28`
- **Artefatos aprovados:** `spec.md`, `clarification.md`
- **Referência:** issue 76 do repositório (ver `spec.md`); mensagem do maintainer na sessão do dashboard em 2026-10-28 ("considere os gates aprovados"), aprovando antecipadamente os Gates 1 e 2 e aceitando as recomendações de CQ-001 a CQ-005.
- **Observações:** aprovação antecipada no chat. CQ-001 a CQ-005 ficam RESOLVIDAS pelas recomendações. A spec avança para `implementing` com `plan.md` e `tasks.md`. Pendências de medição mantidas e declaradas: a aparência e o desempenho (fps) ao vivo numa GPU real não foram medidos e não há validação com mão real. O Gate 3 segue para o fim, após o código e a verificação visual registrada em `validation.md`, e será concedido com risco aceito.
