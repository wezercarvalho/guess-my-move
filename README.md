# Guess My Move

> An open-source AI-powered charades game where players act out prompts on camera and AI tries to guess what they're miming.

**Act it. Let AI guess.** O jogador interpreta uma ação diante da webcam e uma IA multimodal tenta adivinhar. A IA nunca recebe a carta; um árbitro semântico valida o palpite.

## Estado

PoC visual (Fase 0) implementada e **ainda não validada com dados reais**. Existe uma tela com a carta **Acenar** que conduz uma rodada completa (câmera com consentimento, captura de frames, palpite da IA, veredito do árbitro, até 3 tentativas com os palpites rejeitados reenviados e nova rodada), a rota `POST /api/guess` no servidor com provedor `mock` (padrão) ou `codex` (Codex CLI, só local) e um harness de benchmark. Dica e sugestão ficam ocultas até o jogador pedir.

O que a PoC prova depende do benchmark (`packages/benchmark`), que só pode ser executado com clipes gravados pelo mantenedor. Até lá, não há nenhuma medição de acurácia ou latência.

## Requisitos

- Node.js 26.12.1 ou superior da linha 26 (ver `.node-version`).
- Yarn 4.18 via Corepack. O Node 26 não distribui o Corepack: instale-o antes com `npm install --global corepack@0.36.0`.
- Modo `codex` (opcional): Codex CLI instalado e autenticado.

## Instalação

```sh
npm install --global corepack@0.36.0
corepack enable
yarn install --immutable
```

Um único `yarn install` na raiz instala todos os workspaces. Antes do primeiro push, instale também o hook de pré-push com `node scripts/git-hooks/install.mjs`.

## Como rodar em modo mock (sem credencial e sem custo)

```sh
cp .env.example .env   # opcional; os padrões já usam GUESSER_PROVIDER=mock
yarn dev:server        # compila core/providers e sobe o NestJS (PORT, padrão 3000)
yarn dev:web           # em outro terminal: Vite com proxy de /api para o servidor
```

Abra o endereço do Vite, ative a câmera, acione **Capturar e adivinhar** e veja o palpite e o veredito. O `mock` devolve um palpite determinístico e serve apenas para exercitar o fluxo; por padrão sempre responde "acenar", então a rodada termina no primeiro palpite.

Servidor compilado: `yarn build` e depois `node apps/server/dist/main.js`.

### API

- `GET /api/health` responde `{ "status": "ok" }`.
- `POST /api/guess` recebe `{ "frames": [{ "timestampMs", "mimeType", "data" }], "rejectedGuesses"?: [] }` (JPEG em base64, sem prefixo) e responde `200 { guess, insufficientEvidence?, durationMs, providerId }`. A rota não recebe nem conhece dados de carta. Erros têm formato estável `{ error: { code, message, retryable } }` com os códigos `invalid_payload`, `payload_too_large`, `rate_limited`, `provider_timeout`, `provider_error`, `invalid_model_response` e `cost_limit_reached`.
- Limites (variáveis de ambiente, ver `.env.example`): `MAX_FRAMES`, `MAX_FRAME_BYTES`, `MAX_TOTAL_BYTES`, `REQUEST_TIMEOUT_MS`, `RATE_LIMIT_PER_MINUTE` e `COST_CEILING_ATTEMPTS_PER_HOUR`.

## Como rodar em modo real (`codex`)

Uso restrito a desenvolvimento e benchmark locais de uma pessoa. O adaptador chama `codex exec` em diretório temporário vazio e somente leitura, uma execução por vez, e usa a sessão autenticada do Codex CLI (assinatura do mantenedor); não é um backend para servir terceiros.

```sh
GUESSER_PROVIDER=codex CODEX_MODEL=gpt-6-luna CODEX_REASONING_EFFORT=low yarn dev:server
```

A latência medida por esse caminho inclui a inicialização do CLI e **não** representa a latência final de um provedor de API. Detalhes e a verificação empírica em [`packages/providers/README.md`](packages/providers/README.md).

## Benchmark do gesto Acenar

O harness offline fica em `packages/benchmark` (protocolo, formato do manifesto e relatório em [`packages/benchmark/README.md`](packages/benchmark/README.md)). Os clipes gravados com consentimento ficam **fora do Git**. Nenhum número de acurácia foi produzido ainda.

## Estrutura

| Pasta                | Conteúdo                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------ |
| `apps/web`           | React + Vite: câmera, captura de frames, tela da PoC.                                      |
| `apps/server`        | NestJS: `GET /api/health`, `POST /api/guess`, limites, erros estáveis, métricas sem mídia. |
| `packages/core`      | TypeScript puro: contratos, carta, árbitro, fallback opcional, motor da rodada.            |
| `packages/providers` | Adaptadores de `GuesserProvider`: `mock` e `codex`.                                        |
| `packages/benchmark` | CLI offline do benchmark.                                                                  |

## Scripts

| Script                       | O que faz                                                        |
| ---------------------------- | ---------------------------------------------------------------- |
| `yarn dev:web`               | Sobe o frontend (Vite).                                          |
| `yarn dev:server`            | Compila `core`/`providers` e sobe o servidor (NestJS, em watch). |
| `yarn typecheck`             | `tsc --noEmit` em todos os workspaces.                           |
| `yarn lint`                  | Oxlint type-aware (`.oxlintrc.json`) em `apps/` e `packages/`.   |
| `yarn test`                  | Vitest em todos os workspaces (resolve pelo código-fonte).       |
| `yarn build`                 | Build de todos os workspaces.                                    |
| `yarn check:static`          | `typecheck` + `lint`.                                            |
| `yarn check:all`             | `check:static` + `test` + `build` (o que o `pr-gate` roda).      |
| `yarn security:dependencies` | Auditoria de dependências (High/Critical bloqueiam).             |

Os gates de governança (`sdd:check`, `test:sdd`, `docs:format:check`, `test:gates`) estão em [Checks de qualidade](docs/development-context/quality/quality-gates.md).

## Privacidade

- A IA adivinhadora não recebe a carta, a dica, a sugestão nem os aliases. Há teste automatizado que falha se qualquer dado da carta entrar no payload.
- Frames da webcam são transitórios: ficam em memória, não são persistidos nem registrados em logs e são descartados após o envio. No modo `codex`, os frames passam por arquivos temporários que são removidos ao fim da tentativa.
- Os frames são enviados a um provedor externo; a interface avisa o jogador.
- Chaves de provedor ficam somente no servidor, em variáveis de ambiente (`.env`, nunca versionado); nunca no bundle do navegador, em logs ou no repositório.
- Nenhuma afirmação de precisão ou latência sem medição registrada.

## Limites conhecidos

- A câmera real, a captura de um `<video>` ao vivo e a aparência da interface foram testadas só com simulações (jsdom); falta verificar em navegador real.
- O árbitro e o motor da rodada rodam no navegador: a avaliação da carta (resposta canônica e aliases) está no bundle do cliente. Isso é aceitável na PoC e não é proteção antifraude; uma versão com pontuação competitiva precisa mover o julgamento para o servidor.
- O benchmark não foi executado com dados reais.
- O adaptador Bedrock (Claude Haiku 5.5 e Nova 2 Lite) e o acesso à AWS ainda não existem.

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

## Contribuição

Leia o [`AGENTS.md`](AGENTS.md) e o [padrão de issues e PRs](docs/development-context/workflow/github-issues.md). Antes do primeiro push, instale as dependências (`yarn install --immutable`) e o hook de pré-push com `node scripts/git-hooks/install.mjs`: a verificação rápida roda na sua máquina e o `pr-gate` remoto continua valendo. Detalhes em [Verificações locais antes do push](docs/development-context/operations/local-development.md#verificações-locais-antes-do-push).

## Licença

Distribuído sob a [licença MIT](LICENSE). Copyright (c) 2026 Wezer Carvalho.
