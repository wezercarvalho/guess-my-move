# Guess My Move

> Open-source gesture games where the browser recognizes your movements from the webcam using on-device computer vision — no server, no cloud AI.

**Act it. The browser checks it.** Você ativa a webcam e joga com a mão. O navegador detecta a mão com o MediaPipe Hand Landmarker, calcula números simples a cada quadro (ângulo, distância entre os dedos) e funções puras e determinísticas decidem o que aconteceu. Nada sai do navegador.

## Jogos

A página inicial (`/`) é um menu com um card por jogo.

| Jogo                        | Página         | Como se joga                                                                                                                                                               | Estado                                                                                                                                                                                                |
| --------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Jogo de cartas (**Acenar**) | `cards.html`   | Veja a carta, aperte **Começar** e faça o gesto. O avaliador (puro, em `packages/core`) reconhece a oscilação do ângulo da mão.                                            | Validado em um spike (12 clipes, uma pessoa) e em rodadas manuais no Chrome desktop. Sem medição de acurácia ou latência geral.                                                                       |
| Bolinhas de gude (**bete**) | `marbles.html` | Atire a bolinha azul no alvo vermelho, com tiros ilimitados. Dois modos de tiro: **Pinça** (padrão) e **Estalo (beta)**. A física e as regras ficam em `packages/marbles`. | Pinça jogada pelo maintainer no Chrome desktop (acertou o alvo em 2 tiros). Estalo em beta, **sem nenhuma medição**: a viabilidade é a pergunta da issue #68. Limiares, ganhos e física são palpites. |

Uma IA jogadora (uma IA que adivinha sem conhecer a carta) é evolução futura, com spec própria. O jogo de cartas e o bete são isolados: mexer em um não muda o outro.

## Requisitos

- Node.js 26.12.1 ou superior da linha 26 (ver `.node-version`).
- Yarn 4.18 via Corepack. O Node 26 não distribui o Corepack: instale-o antes com `npm install --global corepack@0.36.0`.
- Chrome desktop, com webcam, para rodar o jogo.

## Instalação

```sh
npm install --global corepack@0.36.0
corepack enable
yarn install --immutable
```

Um único `yarn install` na raiz instala todos os workspaces (`apps/web`, `packages/core`, `packages/marbles`). Antes do primeiro push, instale também o hook de pré-push com `node scripts/git-hooks/install.mjs`.

## Como rodar

```sh
yarn dev:web
```

`yarn dev:web` roda primeiro `prepare:assets` (copia o `.wasm` do MediaPipe do pacote npm e baixa o modelo `hand_landmarker.task`, verificando o SHA-256 fixado) e sobe o Vite. Abra o endereço do Vite no Chrome desktop e escolha um jogo no menu. No jogo de cartas (`cards.html`), autorize a câmera, aperte **Começar** e faça o gesto; o app indica "reconhecido" ou "não reconhecido" ao fim do limite da rodada (10 s por padrão).

O modelo não é versionado no repositório; `apps/web/public/mediapipe/` fica fora do Git e é preparado pelo script. O primeiro `prepare:assets` precisa de rede para baixar o modelo; depois ele reaproveita o arquivo em cache.

### Bolinhas de gude (bete)

Abra `/marbles.html` (por exemplo, `http://localhost:5173/marbles.html`) no Chrome desktop, autorize a câmera e escolha o **modo de tiro** no seletor. O vídeo e o esqueleto aparecem espelhados, como num espelho.

- **Pinça (padrão):** feche a pinça (polegar e indicador juntos) em qualquer ponto, com a mão que preferir, arraste a mão para longe do alvo e abra os dedos. A mira é relativa: só o deslocamento da mão desde onde a pinça fechou conta, e o arrasto vale 1,5 vez no campo.
- **Estalo (beta):** feche a pinça com a mão apontada para o alvo e **abra rápido**, como o estalo do polegar. A direção vem da orientação da mão e a força, da velocidade com que a pinça abre. Abrir devagar cancela o tiro. Escolha o modo também por `?mode=estalo` na URL.

O painel de depuração mostra o delegate, o estado, a razão da pinça, se a pinça está fechada, se a mão está visível, os quadros processados e a latência; no estalo, mostra também se está armado, a velocidade e a duração da abertura e o resultado do último estalo. `?delegate=cpu|gpu` também vale aqui.

### Delegate GPU ou CPU

Por padrão o detector tenta o delegate **GPU** e recua para **CPU** se a criação falhar. Para comparar, force um delegate pela URL, sem recuo: `?delegate=gpu` ou `?delegate=cpu`. O delegate efetivo aparece no painel de depuração, junto do ângulo atual, das inversões, das amostras da janela, dos quadros processados e da latência de inferência (mediana e p95).

### Build de produção

```sh
yarn build     # prepare:assets + tsc --build + vite build (saída em apps/web/dist)
yarn preview   # serve o build localmente
```

## Estrutura

| Pasta              | Conteúdo                                                                                                                                     |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web`         | React + Vite: menu, câmera, detector MediaPipe atrás da interface `HandTracker`, laço por quadro, esqueleto, painéis e as páginas dos jogos. |
| `packages/core`    | TypeScript puro do jogo de cartas: schema e carta, ângulo da mão, avaliador da oscilação e máquina de estados da rodada.                     |
| `packages/marbles` | TypeScript puro do bete: física 2D de círculos, detector de pinça, tiro por arrasto, detector de estalo e máquina de estados da rodada.      |

Os núcleos são puros (sem DOM, câmera ou MediaPipe): `packages/core` expõe `handAngleDeg`, `evaluateOscillation`, `createRound`, a carta e `toPublicCard`; `packages/marbles` expõe `stepBodies`, `createPinchDetector`, `computeShot`, `createFlickDetector`, `flickShot` e `createBeteRound`. O detector, o desenho e as telas ficam só em `apps/web`.

## Scripts

| Script                       | O que faz                                                         |
| ---------------------------- | ----------------------------------------------------------------- |
| `yarn dev:web`               | Prepara os ativos do MediaPipe e sobe o frontend (Vite).          |
| `yarn typecheck`             | `tsc --noEmit` em todos os workspaces.                            |
| `yarn lint`                  | Oxlint type-aware (`.oxlintrc.json`) em `apps/` e `packages/`.    |
| `yarn test`                  | Vitest em todos os workspaces (e o teste do script de ativos).    |
| `yarn build`                 | Build de todos os workspaces (o web roda `prepare:assets` antes). |
| `yarn check:static`          | `typecheck` + `lint`.                                             |
| `yarn check:all`             | `check:static` + `test` + `build` (o que o `pr-gate` roda).       |
| `yarn security:dependencies` | Auditoria de dependências (High/Critical bloqueiam).              |

Os gates de governança (`sdd:check`, `test:sdd`, `docs:format:check`, `test:gates`) estão em [Checks de qualidade](docs/development-context/quality/quality-gates.md).

## Privacidade

- Processamento 100% local: nenhuma imagem, vídeo ou landmark é enviado, gravado ou registrado em log. Uma rodada não faz requisição de rede com mídia — só carrega o app e os arquivos do detector, servidos pelo próprio app.
- Não há servidor, variáveis de ambiente de provedor nem chave de IA no fluxo principal.
- A câmera é ativada com consentimento explícito do navegador, com indicador de câmera ativa e opção de parar a captura.
- O critério de avaliação da carta nunca vai ao jogador: `toPublicCard` devolve só a parte pública, com teste automatizado que falha se a avaliação vazar.
- Nenhuma afirmação de acurácia, taxa de quadros ou latência geral sem medição registrada.

## Limites conhecidos

- O reconhecimento do Acenar foi validado em um spike (12 clipes, uma pessoa, Chromium headless) e em rodadas manuais no Chrome desktop com GPU. Recall e falsos positivos no desktop não foram medidos, e o resultado não generaliza para outras pessoas, câmeras e iluminação.
- No bete, a pinça foi jogada pelo maintainer (razão da pinça fechada entre 0,16 e 0,26; latência de 8 a 10 ms em GPU), mas os limiares, o ganho, a escala da mira e a física são palpites não calibrados. O **estalo (beta)** ainda não foi medido: o estalo dura poucos quadros e o detector pode perder a mão em movimento rápido; a decisão de mantê-lo, limitá-lo ou descartá-lo é da issue #68.
- O reconhecimento depende da taxa de quadros do dispositivo. Em CPU numa VPS a latência foi de 100 a 210 ms por quadro.
- Alvo suportado: Chrome desktop. Celular e outros navegadores ficam para depois.
- A licença do arquivo `.task` do modelo não foi lida na fonte (o pacote `@mediapipe/tasks-vision` é Apache-2.0). O arquivo é baixado no build e não é versionado; confirme a licença antes de versioná-lo ou redistribuí-lo.

## Documentação

| Assunto                                                    | Documento                                                                                                              |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Especificação do produto e arquitetura                     | [`docs/product/PROJECT_SPEC.md`](docs/product/PROJECT_SPEC.md)                                                         |
| Pesquisa de modelo multimodal (futura IA jogadora)         | [`docs/research/multimodal-model-selection.md`](docs/research/multimodal-model-selection.md)                           |
| Estratégia de desenvolvimento (SDD)                        | [`docs/development-strategies/`](docs/development-strategies/README.md)                                                |
| Contexto técnico (arquitetura, qualidade, CI, privacidade) | [`docs/development-context/`](docs/development-context/README.md)                                                      |
| Specs                                                      | [`specs/`](specs/README.md)                                                                                            |
| Pipeline de CI e gates                                     | [`docs/development-context/delivery/ci-pipeline.md`](docs/development-context/delivery/ci-pipeline.md)                 |
| Desenvolvimento local e hook de pré-push                   | [`docs/development-context/operations/local-development.md`](docs/development-context/operations/local-development.md) |
| Guia para agentes e colaboradores                          | [`AGENTS.md`](AGENTS.md)                                                                                               |

## Contribuição

Leia o [`AGENTS.md`](AGENTS.md) e o [padrão de issues e PRs](docs/development-context/workflow/github-issues.md). Antes do primeiro push, instale as dependências (`yarn install --immutable`) e o hook de pré-push com `node scripts/git-hooks/install.mjs`: a verificação rápida roda na sua máquina e o `pr-gate` remoto continua valendo. Detalhes em [Verificações locais antes do push](docs/development-context/operations/local-development.md#verificações-locais-antes-do-push).

## Licença

Distribuído sob a [licença MIT](LICENSE). Copyright (c) 2026 Wezer Carvalho.
