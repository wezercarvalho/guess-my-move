# Revisão após os merges de 6 de novembro de 2026

## Escopo e conclusão

Base auditada: `main` em `889d7650582c5562ff9807c612748e15c15ab47e`. Revisão de código, contratos, configuração de segurança, CI, fluxo GitHub e organização das responsabilidades. Não foram implementadas as correções de produto; os achados viraram trabalho para tratamento posterior.

A base tem decisões adequadas: núcleos puros, módulos Nest por domínio, servidor autoritativo, validação estrita, origem explícita, orçamento compartilhado entre namespaces, métricas protegidas, telemetria externa opcional e câmera processada localmente. Modos de bolinhas já usam um contrato de comportamento e composição, próximo de Strategy. Não é necessário trocar tudo por classes ou aplicar patterns pelo nome.

Há três bugs de recuperação reproduzidos e uma lacuna de disponibilidade na admissão do transporte. Há também dívida de manutenção e do fluxo de entrega. Os controllers de 1.033/877 linhas e os serviços de sala de 683/496 linhas concentram motivos diferentes para mudar; o tamanho é uma evidência auxiliar. A direção recomendada é composição com portas/adaptadores e políticas pequenas, mantendo os núcleos e evitando uma superclasse de jogos ou limites arbitrários de linhas.

## Backlog registrado

| Issue                                                                                                                                             | Tipo de evidência                                                                     | Encaminhamento                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| [#124](https://github.com/wezercarvalho/guess-my-move/issues/124) — Limitar conexões Engine.IO antes da entrada nos namespaces                    | Reprodução local: oito transportes abertos com teto 1; contador da aplicação em zero. | Prioridade 1; admissão antes do namespace e reservas com cleanup.                    |
| [#125](https://github.com/wezercarvalho/guess-my-move/issues/125) — Preservar a retomada do Arranha-Teia em falhas transitórias de ACK            | Teste com timeout de ACK de resume elimina acesso e sala recuperáveis.                | Prioridade 1; distinguir falha transitória e recusa definitiva.                      |
| [#126](https://github.com/wezercarvalho/guess-my-move/issues/126) — Recuperar o lobby do Arranha-Teia quando o ACK de entrada não chega           | Teste com estado anterior ao ACK e timeout deixa sala sem identidade.                 | Prioridade 1; recuperação que considere a participação já criada no servidor.        |
| [#127](https://github.com/wezercarvalho/guess-my-move/issues/127) — Invalidar comandos antigos de bolinhas ao reconectar ou destruir o cliente    | Teste aceita ACK antigo após queda/reconexão sem emitir resume.                       | Prioridade 1; geração de conexão, cancelamento e cleanup.                            |
| [#128](https://github.com/wezercarvalho/guess-my-move/issues/128) — Separar captura, controles e sincronização dos controladores web              | Leitura dos dois controladores e concentração de captura/rede/mundo/renderização.     | Prioridade 2; separar responsabilidades em incrementos por jogo.                     |
| [#129](https://github.com/wezercarvalho/guess-my-move/issues/129) — Isolar ciclo de sala, objetivos e projeções públicas no backend               | Leitura dos serviços de sala, projeções, gerador de objetivos e gateways.             | Prioridade 2; mappers/políticas e pipeline comum apenas onde houver semântica igual. |
| [#130](https://github.com/wezercarvalho/guess-my-move/issues/130) — Conferir contratos exportados no gate obrigatório de código                   | contracts:check passou, mas não é chamado por check:all, CI ou hook.                  | Prioridade 2; impedir divergência de documentos exportados.                          |
| [#131](https://github.com/wezercarvalho/guess-my-move/issues/131) — Reconciliar o aceite SDD e o encerramento após merges encadeados              | PR encadeada integrada; issues permaneceram abertas e specs continuam validating.     | Prioridade 2; reconciliar Gate 3 e fluxo pós-merge.                                  |
| [#132](https://github.com/wezercarvalho/guess-my-move/issues/132) — Acompanhar o patch de segurança do Node e formalizar a atualização do runtime | Aviso oficial de segurança do Node para 11/11; auditoria npm não cobre runtime.       | Prioridade 1; acompanhar publicação e validar o patch correto.                       |

Issues novas estão em triagem e atribuídas ao maintainer. Prioridade do backlog não equivale a uma classificação CVSS. A lacuna Engine.IO afeta disponibilidade; não foi demonstrada exfiltração, execução remota nem exploração em produção. Nenhum CVE novo foi atribuído nesta revisão.

## Evidências e reprodução

- [Patch exploratório dos clientes](evidence/client-reproductions.patch): aplica três testes que **afirmam o comportamento defeituoso atual**, para reprodução da auditoria. Não são critérios de sucesso da futura correção. O patch foi aplicado temporariamente à suíte focada, os 33 testes passaram, e o arquivo original foi restaurado. Não foi incorporado à suíte de produto.
- [Reprodução de admissão](evidence/engine-admission.mjs) e [resultado](evidence/engine-admission.json): oito handshakes locais, sem CONNECT de namespace, com limites 1/1. Sem tráfego contra serviço externo e sem teste destrutivo de carga.
- Revisão dos dois PRs: #123 foi mesclada na branch da #118 às **11:31:47 de 06/11/2026, horário de Brasília**; #118 foi integrada à main às **11:33:56**. `git merge-base --is-ancestor 5006f97 origin/main` confirmou a inclusão do último commit da entrega. Ambos os PRs têm execuções finais dos gates com SUCCESS; execuções anteriores puladas por draft não foram confundidas com sucesso.
- A main está protegida pelo ruleset ativo `Protection main`, com PR e check obrigatório `gate (required): consolida governança e auditoria`. O endpoint antigo de branch protection retorna 404 porque a proteção é por ruleset; isso não significa ausência de proteção. O ruleset permite integração sem aprovação formal de outro reviewer e não exige atualização estrita da branch. Não alteramos essas decisões do maintainer.

Para repetir os testes dos clientes em checkout descartável da base auditada: aplicar o patch e executar o script oficial `yarn workspace @guess-my-move/web test:swing-network`; depois descartar somente o patch aplicado. Para a reprodução Engine.IO: compilar os pacotes e backend com `yarn contracts:check`, então executar `node docs/reviews/2026-11-06-post-merge/evidence/engine-admission.mjs`. O roteiro exige as dependências instaladas e o backend compilado; é demonstração exploratória, não gate obrigatório de CI.

A primeira tentativa de reprodução de bolinhas usou um código fora do alfabeto do contrato, falhou por validação e foi corrigida para `ABC234`. Só a reprodução com código válido fundamenta o achado.

## Issues abertas e aceite

As issues #119–#122 descrevem a entrega técnica integrada, com critérios exercitados por testes e evidências dos PRs aceitos pelo maintainer. Foram reconciliadas e encerradas com comentário que referencia os merges; bugs descobertos nesta auditoria permanecem nas novas issues. O fechamento não certifica inexistência de bugs e não muda retroativamente o Gate 3 das specs.

O encerramento automático falhou porque as palavras `Closes` da PR #123 foram publicadas contra uma branch que não era a padrão. O GitHub [documenta que ignora essas palavras nesse caso](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue). Integrar essa branch posteriormente não transforma a descrição da PR intermediária num fechamento garantido. O [guia de issues](../../development-context/workflow/github-issues.md) agora contém o procedimento de reconciliação.

As issues #95–#104 do Violão continuam abertas e em standby até dezembro, conforme instrução do maintainer; não foram consideradas entregues nem reativadas. #18, #19 e #52 continuam abertas: não há evidência de conclusão integral; #52 trata de avaliação futura da versão estável indicada no próprio título. Não há motivo para fechar todas as issues só porque houve merges recentes.

As duas specs de 06/11 permanecem `validating`, com Gate 3 pendente. O maintainer precisa registrar o veredito e os riscos aceitos com os campos exigidos pelo fluxo, ou documentar por que o aceite formal continua pendente (#131). Esta revisão não fabrica uma aprovação humana. Não falta uma skill obrigatória: `AGENTS.md`, guia e template já são pontos canônicos; um checklist compartilhado resolve a lacuna sem duplicar políticas em skills locais.

## Segurança do runtime

A auditoria de dependências executada em 06/11 retornou zero achados. O [aviso oficial do Node](https://nodejs.org/en/blog/vulnerability/november-2026-security-releases) anuncia correções HIGH para 26.x em 11/11 ou pouco depois. A aplicabilidade específica exige os detalhes da publicação; em 06/11 o patch anunciado ainda é futuro. [Node 26.13.0](https://nodejs.org/en/blog/release/v26.13.0) muda os metadados para LTS e não inclui alterações de código sobre 26.12.1. Não tratamos a simples troca para LTS como correção desse aviso.

## Verificações executadas

Em Node 26.12.1 / Yarn 4.18.1, em 06/11/2026:

| Verificação                                                                    | Resultado e alcance                                                                                                        |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `yarn install --immutable` e instalação/conferência do hook                    | PASS; checkout da revisão com dependências próprias.                                                                       |
| `yarn workspace @guess-my-move/web test:swing-network`, com patch exploratório | PASS: 33 testes; os três testes adicionais demonstram comportamentos defeituosos atuais.                                   |
| Mesmo script após restaurar a suíte de produto                                 | PASS: 30 testes.                                                                                                           |
| `yarn contracts:check`                                                         | PASS: HTTP, swing e multiplayer conferidos, após build dos pacotes/backend.                                                |
| Demonstração Engine.IO limitada                                                | Confirmou 8 conexões abertas com teto 1/1 e contador de admissão zero; resultado igual no checkout recompilado da revisão. |
| `yarn security:dependencies`                                                   | PASS: info=0, low=0, moderate=0, high=0, critical=0.                                                                       |
| `yarn sdd:check`                                                               | PASS estrutural; não certifica aceite humano nem segurança do código.                                                      |
| `yarn docs:format:check`                                                       | PASS.                                                                                                                      |
| Gates dos PRs #118 e #123 no GitHub                                            | Execuções finais SUCCESS, incluindo agregado completo de código; não substituídos por resultados antigos pulados.          |

Não repetimos o agregado completo de código localmente para esta alteração documental. A suíte focada, conferência de contratos, demonstração do transporte, auditoria e inspeção de código são evidências desta revisão; os agregados completos são os executados no CI dos merges. Nenhum arquivo de aplicação foi alterado na PR documental.

## Limites

Revisão exploratória, não certificação de ausência de bugs ou pentest completo. Não houve teste com câmera/GPU física, rede externa, múltiplas instâncias ou carga prolongada. Foram inspecionados os pontos de entrada, recuperação, limites e políticas de privacidade; componentes futuros não foram implementados. Não alteramos deploy, runtime, ruleset, regras dos jogos ou recursos do Violão.
