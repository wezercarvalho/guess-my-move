# Índice de contexto de desenvolvimento

Contexto técnico reutilizável, carregado sob demanda. Estratégias (como conduzir uma mudança) ficam em [`../development-strategies/`](../development-strategies/README.md); decisões de produto ficam em [`../product/PROJECT_SPEC.md`](../product/PROJECT_SPEC.md).

| Área        | Documento                                                                 | Quando consultar                                                         |
| ----------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Workflow    | [Padrão de issues e PRs](workflow/github-issues.md)                       | Registrar trabalho, abrir PR, fechar issue.                              |
| Qualidade   | [Checks de qualidade](quality/quality-gates.md)                           | Escolher e executar gates.                                               |
| Segurança   | [Privacidade e segredos](security/privacy-and-secrets.md)                 | Câmera, frames, chaves de API, logs, retenção.                           |
| Arquitetura | [Guia de arquitetura](architecture/architecture-guide.md)                 | Fronteiras entre componentes e contratos internos.                       |
| Entrega     | [Pipeline de CI](delivery/ci-pipeline.md)                                 | `pr-gate`, workflows, seleção por path e como adicionar um escopo.       |
| Operação    | [Desenvolvimento local](operations/local-development.md)                  | Hook de pré-push, scripts de governança, requisitos locais.              |
| Segurança   | [Auditoria de dependências](security/dependency-audit.md)                 | Severidade, exceções e rotina quinzenal de `yarn security:dependencies`. |
| Pesquisa    | [Seleção do modelo multimodal](../research/multimodal-model-selection.md) | Escolha e troca de provedor/modelo.                                      |

Regra: carregue apenas o que a mudança exige e confirme a realidade na configuração do repositório antes de confiar em exemplos documentais.
