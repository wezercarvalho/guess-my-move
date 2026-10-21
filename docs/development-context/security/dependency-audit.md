# Auditoria de dependências

Política do gate `yarn security:dependencies`. O auditor roda `yarn npm audit` em dois ambientes, classifica os advisories e decide o veredito; as regras abaixo valem para qualquer pacote do repositório que passe a usar o mesmo auditor.

| Item                | Valor                                                                                         |
| ------------------- | --------------------------------------------------------------------------------------------- |
| Comando             | `yarn security:dependencies`                                                                  |
| Auditor             | `scripts/audit-dependencies.mjs` e `scripts/lib/dependency-audit*.mjs` (ESM, só módulos Node) |
| Arquivo de exceções | `scripts/dependency-audit-exceptions.json`                                                    |
| Job de PR           | `audit`, no workflow `pr-gate`                                                                |
| Rotina na main      | `dependency-audit.yml`, dias 1 e 15, 08:23 UTC, mais disparo manual                           |
| Testes              | `test/security/`, com relatórios sintéticos, sem depender do estado do registry               |

## Política

- **Severidade:** High e Critical bloqueiam, tanto em produção quanto em tooling. Info, Low e Moderate são reportados sem bloquear.
- **Alcance:** o relatório separa `produção` de `tooling`, e o alcance vem do próprio Yarn. O auditor executa `yarn npm audit --all --recursive --json` duas vezes — com `--environment production` (escopo `produção`) e com `--environment development` (escopo `tooling`) — e deduplica os advisories por `(id, pacote)`, com produção vencendo: um pacote presente nos dois ambientes aparece como `produção`. Não há leitura do `package.json` para decidir o alcance; quem o decide é o Yarn 4.
- **Exceção:** um High/Critical que não possa ser corrigido de imediato só deixa de bloquear por exceção aprovada pelo maintainer, registrada no arquivo de exceções (raiz `{ "exceptions": [ ... ] }`). Cada entrada traz `advisory` (identificador GHSA), `package`, `owner`, `justification`, `approval` (referência rastreável, como o link da issue ou do PR), `approvedAt` e `expiresAt` (`AAAA-MM-DD`).
    - A exceção vale somente para o par advisory e pacote; não há curinga de pacote nem de severidade.
    - A validade é de no máximo 90 dias a partir de `approvedAt` e vai até o fim do dia de `expiresAt`. Vencida, o advisory volta a bloquear.
    - Entrada inválida (JSON quebrado, campo ausente, curinga, validade acima do máximo ou anterior à aprovação, duplicidade) faz o auditor falhar com `excecoes-invalidas`, sem aplicar nenhuma exceção. Arquivo ausente equivale a nenhuma exceção.
    - A exceção sem advisory correspondente é apenas informada.
- **Identidade do advisory:** o identificador é o GHSA extraído do caminho `…/advisories/GHSA-xxxx-xxxx-xxxx` da URL do advisory; quando a URL não traz um GHSA, usa-se `npm-<ID>` com o id numérico do Yarn. As versões instaladas vêm de `Tree Versions`, as versões vulneráveis de `Vulnerable Versions`, a versão corrigida fica como `desconhecida` (o Yarn 4 não a informa) e a contagem de caminhos é o número de `Dependents` distintos.
- **Agrupamento:** os advisories são agrupados por identificador e pacote; cada par é listado e tratado, e pode receber exceção, separadamente.

## Onde roda

- **No PR:** o job `audit` do `pr-gate` roda somente quando o PR altera o que muda o veredito: `package.json`, `yarn.lock`, `scripts/audit-dependencies.mjs`, `scripts/dependency-audit-exceptions.json`, `scripts/lib/dependency-audit*.mjs` ou os workflows `pr-gate` e `dependency-audit`. O PR que não toca nesses arquivos não executa o job e não é bloqueado por advisory novo. Quando o job é pulado, o check obrigatório não falha; quando roda e falha, bloqueia.
- **Na main:** a rotina `dependency-audit.yml` roda nos dias 1 e 15 e pode ser disparada manualmente (somente depois de o arquivo existir na main). Usa permissão só de leitura e nenhum segredo. A falha aparece como execução vermelha no GitHub Actions; não há issue automática. Um advisory novo pode reprovar uma árvore que não mudou, e nenhum PR dispara nesse caso: a rotina é o que o detecta.
- **No hook local:** o pré-push roda o auditor quando os arquivos enviados casam o padrão de auditoria (ver [Desenvolvimento local](../operations/local-development.md#verificações-locais-antes-do-push)). Falha de registry só avisa; vulnerabilidade barra.
- **Fora dos agregados de teste:** `yarn test:gates` e `yarn test:sdd` não executam a auditoria, porque o veredito muda sem mudança de código.

## Diagnósticos

Quando o auditor não consegue emitir veredito, a mensagem começa pela categoria entre colchetes. As categorias de execução são estáveis: `saida-invalida` (uma linha do NDJSON não é JSON), `formato-inesperado` (registro sem `value`/`children`/`ID`/`Severity` válidos), `yarn-falhou` (o Yarn saiu com código diferente de zero sem relatório e sem assinatura de rede), `yarn-sinal` (o Yarn foi encerrado por sinal), `yarn-nao-iniciou` (o comando do Yarn não pôde iniciar), `limite-de-saida` (a saída excedeu o buffer), `timeout` (a execução excedeu o orçamento), `excecoes-invalidas` (ver acima) e `erro-interno` (defeito inesperado do auditor). Saída vazia com código de saída 0 é um relatório limpo, não uma falha. Além delas:

- `registry-indisponivel`: o Yarn não conseguiu consultar o registry; o veredito não foi emitido, não é vulnerabilidade e a execução deve ser repetida. O erro é reconhecido pelas assinaturas de rede no stderr do Yarn 4 (`RequestError`, `HTTPError`, `ECONNREFUSED`, `ENOTFOUND`, `ETIMEDOUT`, `ECONNRESET`, `EAI_AGAIN`, `socket hang up`, `Response code`). No gate remoto, falha de registry reprova (falha fechada); no hook local, só avisa. O marcador é estável e o hook depende dele: se o texto mudar, o hook passa a barrar (lado seguro).

> As categorias `sem-dados` e `erros-do-yarn` do auditor anterior saíram: o `yarn npm audit` do Yarn 4 trata a saída vazia como relatório limpo e não emite registros de erro no NDJSON.

## Alcance por ambiente

O alcance (`produção` vs `tooling`) agora vem de `--environment`: o auditor roda `yarn npm audit` com `--environment production` e com `--environment development` e funde os resultados, com produção vencendo o mesmo par `(id, pacote)`. O endpoint consultado é o de advisories em lote do registry (`/-/npm/v1/security/advisories/bulk`); se ele ficar indisponível, o gate falha como `registry-indisponivel` até a rede voltar.

## Workspaces

O auditor roda a partir da raiz (`--recursive` cobre todos os workspaces do monorepo com um só lockfile). O `package.json` da raiz não precisa mais declarar o objeto `dependencies`: o alcance de produção e de tooling é decidido pelo Yarn via `--environment`, não pela leitura do manifesto. Dependências de produção que tocam frames de webcam ou chaves de provedor seguem também o guia de [privacidade e segredos](privacy-and-secrets.md).
