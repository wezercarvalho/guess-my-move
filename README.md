# Guess My Move

> An open-source AI-powered charades game where players act out prompts on camera and AI tries to guess what they're miming.

**Act it. Let AI guess.** O jogador interpreta uma ação diante da webcam e uma IA multimodal tenta adivinhar. A IA nunca recebe a carta; um árbitro semântico (fase posterior) valida o palpite.

## Estado

PoC em andamento. O monorepo tem uma base executável: frontend (`apps/web`), servidor (`apps/server`) e contratos compartilhados (`packages/core`). A primeira entrega funcional é a **Fase 0 (PoC visual)** com uma única carta, **Acenar**: validar se um modelo multimodal pré-treinado reconhece o gesto a partir de uma sequência curta de frames. O servidor expõe hoje apenas `GET /api/health` e sobe no modo **mock** por padrão (`GUESSER_PROVIDER=mock`); a carta, a câmera, a captura de frames e o adivinhador chegam nas próximas issues.

## Requisitos

- Node.js 24.18 ou superior (ver `.node-version`).
- Yarn 1.22 via Corepack (`corepack enable`).

## Instalação

```sh
corepack enable
yarn install --frozen-lockfile
```

Um único `yarn install` na raiz instala a raiz e todos os workspaces (`apps/web`, `apps/server`, `packages/core`). Antes do primeiro push, instale também o hook de pré-push com `node scripts/git-hooks/install.mjs`.

## Como rodar (modo mock)

O servidor usa `GUESSER_PROVIDER=mock` por padrão; copie `.env.example` para `.env` e ajuste se quiser.

```sh
yarn dev:server   # sobe o servidor NestJS (porta configurável via PORT, padrão 3000)
yarn dev:web      # sobe o frontend Vite; o proxy /api aponta para o servidor
```

Com o servidor no ar, `GET /api/health` responde `{ "status": "ok" }`. A porta do servidor é configurável por `PORT`; o Vite encaminha `/api` para `http://localhost:$VITE_SERVER_PORT` (padrão 3000).

## Scripts

| Script                       | O que faz                                                           |
| ---------------------------- | ------------------------------------------------------------------- |
| `yarn dev:web`               | Sobe o frontend (Vite).                                             |
| `yarn dev:server`            | Sobe o servidor (NestJS, em watch).                                 |
| `yarn typecheck`             | `tsc --noEmit` em todos os workspaces.                              |
| `yarn lint`                  | ESLint (flat config) com TypeScript estrito em `apps/`/`packages/`. |
| `yarn test`                  | Vitest em todos os workspaces.                                      |
| `yarn build`                 | Build do frontend, do servidor e do pacote `core`.                  |
| `yarn check:static`          | `typecheck` + `lint`.                                               |
| `yarn check:all`             | `check:static` + `test` + `build` (o que o `pr-gate` roda).         |
| `yarn security:dependencies` | Auditoria de dependências (High/Critical bloqueiam).                |

## Privacidade

- A IA adivinhadora não recebe a carta, a dica, a sugestão nem os aliases.
- Frames da webcam são transitórios: não são persistidos por padrão nem registrados em logs.
- Chaves de provedor ficam somente no servidor, em variáveis de ambiente (`.env`, nunca versionado); nunca no bundle do navegador, em logs ou no repositório.
- Nenhuma afirmação de precisão ou latência sem medição registrada.

## Limites conhecidos

- Só há o scaffold: a rota `POST /api/guess`, a carta, a câmera, a captura de frames, o adivinhador (mock/codex), o árbitro e o motor ainda não existem.
- O servidor expõe apenas `GET /api/health`.
- O modo `codex` está desligado por padrão e ainda não tem adaptador implementado.
- A licença será definida antes de divulgar o projeto como reutilizável por terceiros.

## Documentação

| Assunto                                                        | Documento                                                                                                              |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Especificação do produto e arquitetura                         | [`docs/product/PROJECT_SPEC.md`](docs/product/PROJECT_SPEC.md)                                                         |
| Prompt de desenvolvimento da Fase 0                            | [`docs/product/DEVELOPMENT_PROMPT.md`](docs/product/DEVELOPMENT_PROMPT.md)                                             |
| Seleção do modelo multimodal                                   | [`docs/research/multimodal-model-selection.md`](docs/research/multimodal-model-selection.md)                           |
| Estratégia de desenvolvimento (SDD)                            | [`docs/development-strategies/`](docs/development-strategies/README.md)                                                |
| Contexto técnico (issues, qualidade, privacidade, arquitetura) | [`docs/development-context/`](docs/development-context/README.md)                                                      |
| Specs                                                          | [`specs/`](specs/README.md)                                                                                            |
| Pipeline de CI e gates                                         | [`docs/development-context/delivery/ci-pipeline.md`](docs/development-context/delivery/ci-pipeline.md)                 |
| Desenvolvimento local e hook de pré-push                       | [`docs/development-context/operations/local-development.md`](docs/development-context/operations/local-development.md) |
| Guia para agentes e colaboradores                              | [`AGENTS.md`](AGENTS.md)                                                                                               |

## Princípios

- A IA adivinhadora não recebe a carta, a dica, a sugestão nem os aliases.
- Frames da webcam são transitórios e nunca persistidos por padrão.
- Chaves de provedor ficam somente no servidor.
- Nenhuma afirmação de precisão ou latência sem medição registrada.

## Contribuição

Leia o [`AGENTS.md`](AGENTS.md) e o [padrão de issues e PRs](docs/development-context/workflow/github-issues.md). Antes do primeiro push, instale as dependências (`yarn install --frozen-lockfile`) e o hook de pré-push com `node scripts/git-hooks/install.mjs`: a verificação rápida roda na sua máquina e o `pr-gate` remoto continua valendo. Detalhes em [Verificações locais antes do push](docs/development-context/operations/local-development.md#verificações-locais-antes-do-push). A licença será definida antes de divulgar o projeto como reutilizável por terceiros.
