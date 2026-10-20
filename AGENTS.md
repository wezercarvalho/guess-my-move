# Gateway canônico para agentes

Este arquivo é o ponto de entrada compartilhado por pessoas e agentes de IA. Ele roteia para as fontes vigentes; não substitui estratégia, spec, contexto técnico nem configurações executáveis.

## Ordem obrigatória de trabalho

1. Verifique o estado do Git e preserve alterações preexistentes e fora do escopo.
2. Classifique risco e selecione a abordagem no [roteador de estratégias](docs/development-strategies/README.md).
3. Quando a estratégia for SDD, leia a [constituição](docs/development-strategies/sdd/constitution.md), localize a spec no [catálogo](specs/README.md) e execute somente a fase autorizada do [ciclo de vida](docs/development-strategies/sdd/README.md).
4. Carregue no [índice de contexto](docs/development-context/README.md) apenas políticas, guias e runbooks aplicáveis.
5. Confirme a realidade em `package.json`, ESLint, TypeScript, Vitest e nos arquivos afetados antes de editar. Enquanto o código não existir, a fonte é a spec aprovada.
6. Implemente e valide com os scripts oficiais de `package.json`; registre limitações reais em vez de presumir sucesso.

## Roteamento de contexto

| Mudança | Fontes mínimas |
| --- | --- |
| Produto, regras do jogo, escopo | [`docs/product/PROJECT_SPEC.md`](docs/product/PROJECT_SPEC.md) |
| Escolha de provedor/modelo multimodal | [Seleção do modelo multimodal](docs/research/multimodal-model-selection.md) |
| Issues, PRs e fechamento | [Padrão de issues e PRs](docs/development-context/workflow/github-issues.md) |
| Testes e gates | [Checks de qualidade](docs/development-context/quality/quality-gates.md) |
| Câmera, frames, chaves de API, logs | [Privacidade e segredos](docs/development-context/security/privacy-and-secrets.md) |
| Arquitetura e contratos internos | [Guia de arquitetura](docs/development-context/architecture/architecture-guide.md) |

## Regras não negociáveis

- Leia e grave texto em UTF-8. Preserve a acentuação em português e não introduza mojibake.
- Não descarte nem sobrescreva mudanças preexistentes sem autorização.
- Faça alterações pequenas, rastreáveis e testáveis.
- **A IA adivinhadora nunca recebe a carta**: palavra, dica, sugestão, aliases ou critérios de avaliação não entram no payload enviado ao modelo. Há teste automatizado para isso quando o código existir.
- Nunca coloque chave de provedor de IA no bundle do navegador, em logs ou no repositório. Use `.env.example` com placeholders.
- Frames da webcam são transitórios: não persista imagens nem vídeos por padrão e não registre dados de imagem em logs.
- Não afirme precisão visual ou latência sem medição registrada; capacidade anunciada não é desempenho comprovado.
- Use somente scripts oficiais de `package.json` como gates do repositório.
- Não faça push direto para `main` depois do commit inicial: use branch e PR.

## Adaptadores

- `CLAUDE.md` importa `@AGENTS.md` e não copia regras.
- `.kiro/steering/repository-rules.md` referencia este arquivo e repete apenas o roteamento mínimo.
- Uma regra específica de provedor nunca prevalece sobre a constituição, a spec aprovada, o contexto compartilhado ou a configuração real.
