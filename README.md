# Guess My Move

> An open-source AI-powered charades game where players act out prompts on camera and AI tries to guess what they're miming.

**Act it. Let AI guess.** O jogador interpreta uma ação diante da webcam e uma IA multimodal tenta adivinhar. A IA nunca recebe a carta; um árbitro semântico (fase posterior) valida o palpite.

## Estado

Planejamento e pesquisa. Ainda não há código. A primeira entrega é a **Fase 0 (PoC visual)** com uma única carta, **Acenar**: validar se um modelo multimodal pré-treinado reconhece o gesto a partir de uma sequência curta de frames.

## Documentação

| Assunto | Documento |
| --- | --- |
| Especificação do produto e arquitetura | [`docs/product/PROJECT_SPEC.md`](docs/product/PROJECT_SPEC.md) |
| Prompt de desenvolvimento da Fase 0 | [`docs/product/DEVELOPMENT_PROMPT.md`](docs/product/DEVELOPMENT_PROMPT.md) |
| Seleção do modelo multimodal | [`docs/research/multimodal-model-selection.md`](docs/research/multimodal-model-selection.md) |
| Estratégia de desenvolvimento (SDD) | [`docs/development-strategies/`](docs/development-strategies/README.md) |
| Contexto técnico (issues, qualidade, privacidade, arquitetura) | [`docs/development-context/`](docs/development-context/README.md) |
| Specs | [`specs/`](specs/README.md) |
| Guia para agentes e colaboradores | [`AGENTS.md`](AGENTS.md) |

## Princípios

- A IA adivinhadora não recebe a carta, a dica, a sugestão nem os aliases.
- Frames da webcam são transitórios e nunca persistidos por padrão.
- Chaves de provedor ficam somente no servidor.
- Nenhuma afirmação de precisão ou latência sem medição registrada.

## Contribuição

Leia o [`AGENTS.md`](AGENTS.md) e o [padrão de issues e PRs](docs/development-context/workflow/github-issues.md). A licença será definida antes de divulgar o projeto como reutilizável por terceiros.
