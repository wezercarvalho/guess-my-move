# Guess My Move

> An open-source charades game where the browser recognizes a card's gesture from the webcam using on-device computer vision — no server, no cloud AI.

**Act it. The browser checks it.** O jogador vê a carta, ativa a webcam, aperta **Começar** e faz o gesto. O navegador detecta a mão com o MediaPipe Hand Landmarker, calcula o ângulo da mão a cada quadro e um avaliador determinístico diz se o gesto da carta foi reconhecido. Nada sai do navegador.

## Estado

A carta inicial é **Acenar**. O critério é a oscilação do ângulo da mão (avaliador puro em `packages/core`), e a interface (`apps/web`) roda o detector no Chrome desktop, desenha o esqueleto da mão e mostra os números do avaliador para ajuste. O reconhecimento foi validado só em um spike (12 clipes, uma pessoa); ainda **não há medição de acurácia ou latência geral**. A IA jogadora (uma IA que adivinha sem conhecer a carta) é evolução futura, com spec própria.

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

Um único `yarn install` na raiz instala todos os workspaces (`apps/web`, `packages/core`). Antes do primeiro push, instale também o hook de pré-push com `node scripts/git-hooks/install.mjs`.

## Como rodar

```sh
yarn dev:web
```

`yarn dev:web` roda primeiro `prepare:assets` (copia o `.wasm` do MediaPipe do pacote npm e baixa o modelo `hand_landmarker.task`, verificando o SHA-256 fixado) e sobe o Vite. Abra o endereço do Vite no Chrome desktop, autorize a câmera, aperte **Começar** e faça o gesto; o app indica "reconhecido" ou "não reconhecido" ao fim do limite da rodada (10 s por padrão).

O modelo não é versionado no repositório; `apps/web/public/mediapipe/` fica fora do Git e é preparado pelo script. O primeiro `prepare:assets` precisa de rede para baixar o modelo; depois ele reaproveita o arquivo em cache.

### Delegate GPU ou CPU

Por padrão o detector tenta o delegate **GPU** e recua para **CPU** se a criação falhar. Para comparar, force um delegate pela URL, sem recuo: `?delegate=gpu` ou `?delegate=cpu`. O delegate efetivo aparece no painel de depuração, junto do ângulo atual, das inversões, das amostras da janela, dos quadros processados e da latência de inferência (mediana e p95).

### Build de produção

```sh
yarn build     # prepare:assets + tsc --build + vite build (saída em apps/web/dist)
yarn preview   # serve o build localmente
```

## Estrutura

| Pasta           | Conteúdo                                                                                                        |
| --------------- | --------------------------------------------------------------------------------------------------------------- |
| `apps/web`      | React + Vite: câmera, detector MediaPipe atrás da interface `HandTracker`, laço por quadro, esqueleto e painel. |
| `packages/core` | TypeScript puro: schema e carta, ângulo da mão, avaliador da oscilação e máquina de estados da rodada.          |

O núcleo é puro (sem DOM, câmera ou MediaPipe): expõe `handAngleDeg`, `evaluateOscillation`, `createRound`, a carta e `toPublicCard`. O detector e o desenho ficam só em `apps/web`.

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

- O reconhecimento foi validado só em um spike (12 clipes, uma pessoa, Chromium headless); não generaliza para outras pessoas, câmeras e iluminação. O teste manual do maintainer no Chrome desktop ainda está pendente.
- A latência medida até agora foi só em CPU numa VPS e não representa o desktop do maintainer.
- Alvo suportado: Chrome desktop. Celular e outros navegadores ficam para depois.
- A licença do arquivo `.task` do modelo não foi confirmada na fonte; por isso ele não é versionado.

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
