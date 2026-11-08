# Plano — 2026-10-30-game-arranha-teia-add-city-catalog

## Resumo técnico

Criar um catálogo JSON local validado, uma camada React `SwingApp` que escolhe o mapa antes de montar `SwingScreen`, e parametrizar o pipeline OSM por definições de cidade. Adicionar o mapa da Avenida Paulista e melhorar o renderizador procedural com iluminação/materiais sem alterar o `City` nem a física.

## Contexto técnico

- **Runtime/versões:** Node >=26.12.1 <27; TypeScript 7.0.2; React 19.3.1; Vite 8.3.4; Three.js 0.186.0.
- **Dependências:** nenhuma nova.
- **Provedores externos:** Overpass API só no build manual; zero provedor em tempo de jogo.
- **Persistência:** arquivos JSON versionados; escolha apenas na URL/sessão, sem `localStorage`.
- **Testes:** Vitest, React Testing Library e `node:test`; scripts oficiais do `package.json`.
- **Restrições:** ODbL e atribuição; caminhos locais; sem token; sem alterar física/câmera/gestos.

## Constitution Check — pré-design

| Princípio/gate                      | Resultado | Evidência ou exceção                                                                |
| ----------------------------------- | --------- | ----------------------------------------------------------------------------------- |
| I. Intenção antes da implementação  | PASS      | Spec/clarificação escritas antes do código; mensagem do maintainer aprova execução. |
| II. Uma fonte vigente               | PASS      | Esta spec governa a implementação; pesquisa da #82 é evidência.                     |
| III. Rastreabilidade                | PASS      | FR-001 a FR-008 mapeados abaixo e nas tarefas.                                      |
| IV. Test-first                      | PASS      | Cada contrato/tela/pipeline começa por teste falhando.                              |
| V. Evidência honesta                | PASS      | Sem afirmar fotorrealismo ou fps; métricas de mapas serão registradas.              |
| VI. Privacidade e segredos          | PASS      | Dados locais em runtime, sem token; câmera intocada.                                |
| VIII. Preservação e operação segura | PASS      | Midtown preservado; troca reversível; branch existente.                             |
| Gate 1 e Gate 2                     | PASS      | Aprovação do maintainer registrada em `clarification.md` e `tasks.md`.              |

## Pesquisa e decisões

- `research.md` referencia o relatório da #82 e registra a escolha local, Midtown + Paulista, e o adiamento do Rio/Cesium.

## Estrutura afetada

```text
apps/web/public/swing/cities.json
apps/web/public/swing/midtown.json
apps/web/public/swing/paulista.json
apps/web/scripts/city-sources.mjs
apps/web/scripts/build-city.mjs
apps/web/scripts/city-from-osm.mjs
apps/web/src/swing/cityCatalog.ts
apps/web/src/swing/CitySelect.tsx
apps/web/src/swing/SwingApp.tsx
apps/web/src/swing/SwingScreen.tsx
apps/web/src/swing/useSwingGame.ts
apps/web/src/swing/cityRenderer.ts
apps/web/src/swing/swing.css
```

## Design

### Componentes e responsabilidades

- `cityCatalog.ts`: tipos e validação do catálogo; exige id seguro, arquivo relativo dentro de `swing/`, campos curtos e atribuição.
- `SwingApp`: carrega o catálogo, resolve `?city=`, mantém o mapa escolhido e desmonta/remonta `SwingScreen` ao trocar.
- `CitySelect`: cards acessíveis, sem câmera/controlador; estado de carregamento/erro.
- `SwingScreen`: recebe o mapa selecionado, mostra nome dinâmico e "Trocar mapa".
- `useSwingGame`: recebe `cityFile`; o controlador continua inalterado e carrega o arquivo por dependência.
- `city-sources.mjs`: definições de Midtown, Paulista e Santa Maria para o build offline.
- `city-from-osm.mjs`: projeção parametrizada; defaults preservam Midtown.
- `cityRenderer.ts`: melhoria de iluminação/material/texturas procedurais e legibilidade das ruas; zero recurso externo.

### Contratos e dados

```ts
type CityMap = {
    id: string
    name: string
    region: string
    description: string
    file: string
    attribution: string
    recommended?: boolean
}
type CityCatalog = { version: 1; maps: CityMap[] }
```

`file` precisa começar por `swing/`, não conter `..`, protocolo ou `//`. O id nunca vira caminho.

### Fluxo

1. `SwingApp` busca `swing/cities.json`.
2. Se `?city=` corresponde ao catálogo, monta o jogo; senão mostra `CitySelect`.
3. O card chama `selectMap`; a URL recebe o id por `history.replaceState` e `SwingScreen` monta com chave do id.
4. "Trocar mapa" desmonta a tela, remove o parâmetro e volta ao catálogo.
5. `SwingScreen` carrega apenas `map.file`, validado pelo catálogo.

## Mapeamento de requisitos

| Requisito | Abordagem                             | Evidência planejada                                    |
| --------- | ------------------------------------- | ------------------------------------------------------ |
| FR-001    | Parser estrito de catálogo            | `cityCatalog.test.ts`                                  |
| FR-002    | `CitySelect` + estados                | `CitySelect.test.tsx`, `SwingApp.test.tsx`             |
| FR-003    | Montagem por chave + troca            | `SwingApp.test.tsx`, teste de dispose                  |
| FR-004    | `cities.json` + arquivos              | `city-data.test.mjs`                                   |
| FR-005    | fontes e conversor parametrizados     | `city-from-osm.test.mjs`, teste de `build-city`        |
| FR-006    | auditoria de catálogo/dados           | `city-data.test.mjs`                                   |
| FR-007    | renderizador procedural; City intacto | `cityRenderer.test.ts`, regressão `cityGeometry`/swing |
| FR-008    | resolução do id só pelo catálogo      | `SwingApp.test.tsx`, `cityCatalog.test.ts`             |

## Estratégia test-first

1. Escrever testes do catálogo, seleção e converter parametrizado; observar falha.
2. Implementar contratos e fluxo mínimo; observar verde.
3. Gerar Paulista pelo script parametrizado e validar dados.
4. Escrever teste das características do renderizador antes do passe visual.
5. Integrar, validar em Chromium e refatorar mantendo testes verdes.

## Riscos, rollout e rollback

| Risco                                   | Mitigação                                             | Rollback/contingência              |
| --------------------------------------- | ----------------------------------------------------- | ---------------------------------- |
| Paulista sem ancoragem suficiente       | Validar alturas e índice; Midtown segue recomendado.  | Remover entrada do catálogo.       |
| Catálogo aponta arquivo externo         | Parser rejeita protocolo, `//` e `..`.                | Voltar ao caminho fixo do Midtown. |
| Passe visual reduz desempenho           | Evitar sombras reais e texturas externas; medir.      | Reverter só o commit visual.       |
| Troca deixa controlador/câmera anterior | Remontar por chave e testar dispose.                  | Navegar/recarregar com `?city=`.   |
| OSM muda entre consultas                | Versionar JSON e registrar métricas/data da extração. | Manter o JSON anterior versionado. |

## Constitution Check — pós-design

| Princípio/gate                         | Resultado | Evidência ou exceção                                                    |
| -------------------------------------- | --------- | ----------------------------------------------------------------------- |
| Intenção, rastreabilidade e test-first | PASS      | Plano/tarefas cobrem FR-001 a FR-008 e testes antecedem código.         |
| Privacidade, segredos e informação     | PASS      | Sem serviço em runtime, token ou alteração na carta/câmera.             |
| Preservação e reversibilidade          | PASS      | Midtown continua no catálogo; commits de dados, UI e visual separáveis. |

## Complexidade e desvios

| Necessidade   | Impacto | Alternativa mais simples rejeitada | Aprovação |
| ------------- | ------- | ---------------------------------- | --------- |
| Nenhum desvio | —       | —                                  | —         |

## Emenda CQ-001 — plano para Santa Maria

A terceira cidade reutiliza os contratos existentes: uma entrada em `city-sources.mjs`, geração offline por `build-city.mjs`, arquivo local `public/swing/santa-maria.json` e entrada em `cities.json`. O recorte central deve ficar abaixo do limite de 1,5 MB e ter prédios e vias suficientes para o teste de dados. A altura inicial será escolhida a partir do perfil vertical gerado, sem alterar a física global. Testes do catálogo, da fonte e dos dados devem falhar antes da implementação e passar depois. A demonstração final abre a seleção, Santa Maria e uma teia por teclado, além de verificar console e origem das requisições.

- **Alternativa rejeitada:** área municipal ampla, porque aumentaria carga sem melhorar a jogabilidade do recorte inicial.
- **Risco:** Santa Maria tem perfil mais baixo e menos alturas explícitas que Midtown; a teia no céu continua sendo a reserva existente.
- **Gate 2 da emenda:** aprovado por wezercarvalho em `2026-10-30`, ao pedir a implementação na mesma branch e solicitar aviso somente ao terminar.

## Emenda CQ-002 — plano das placas de rua

- `packages/swing/src/city.ts`: `CityRoad.name?: string` (opcional; formato continua v1).
- `apps/web/scripts/city-from-osm.mjs`: copia `tags.name` (sem espaços nas pontas) para a via; sem nome, a via fica como era.
- `apps/web/src/swing/streetSigns.ts` (módulo puro, testado): `findStreetCorners(city, isClear)` acha cruzamentos entre segmentos de vias com nomes diferentes, agrupa em 15 m, escolhe as duas ruas mais largas e não paralelas e posiciona o poste num dos quatro cantos livres (ou no centro, se nenhum estiver livre); `plateArrowAngle(direction, yaw)` e `rowOrder(a, b, yaw)` dão a seta e a ordem das linhas em relação à câmera.
- `apps/web/src/swing/cityRenderer.ts`: um grupo por esquina (poste, fundo, duas linhas com texto em canvas e seta de duas pontas), texturas de texto em cache por nome, `fog: false` no texto, grupo visível só a até 280 m da câmera, voltado para a câmera pela guinada e com seta e ordem atualizadas a cada quadro.
- `apps/web/public/swing/santa-maria.json`: regenerado pelo `build:city` para trazer os nomes.
- **Alternativa rejeitada:** guardar as esquinas no JSON, pois duplicaria dados que se derivam do próprio mapa e dificultaria regenerar cidades.
- **Risco:** o OSM pode ter vias sem nome ou nomes diferentes para o mesmo trecho; a placa só aparece onde há dois nomes. O JSON regenerado pode diferir do anterior se o OSM mudou, e os números serão medidos de novo.
- **Gate 2 da emenda:** aprovado por wezercarvalho em `2026-10-30`, ao pedir a implementação e o aviso para testar.
