# Auditoria de dependências

Política do gate `yarn security:dependencies`. O auditor roda `yarn audit --json`, classifica os advisories e decide o veredito; as regras abaixo valem para qualquer pacote do repositório que passe a usar o mesmo auditor.

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
- **Alcance:** o relatório separa `produção` de `tooling`. É `produção` o advisory alcançável a partir das `dependencies` da raiz ou de qualquer workspace (o primeiro item da cadeia de dependência decide); é `tooling` o que só chega por `devDependencies`. O advisory alcançável pelos dois é `produção`. A flag `dev` do Yarn 1 não é usada, porque vem sempre falsa. O objeto `dependencies` da raiz DEVE existir, mesmo vazio (ver [Workspaces](#workspaces)).
- **Exceção:** um High/Critical que não possa ser corrigido de imediato só deixa de bloquear por exceção aprovada pelo maintainer, registrada no arquivo de exceções (raiz `{ "exceptions": [ ... ] }`). Cada entrada traz `advisory` (identificador GHSA), `package`, `owner`, `justification`, `approval` (referência rastreável, como o link da issue ou do PR), `approvedAt` e `expiresAt` (`AAAA-MM-DD`).
    - A exceção vale somente para o par advisory e pacote; não há curinga de pacote nem de severidade.
    - A validade é de no máximo 90 dias a partir de `approvedAt` e vai até o fim do dia de `expiresAt`. Vencida, o advisory volta a bloquear.
    - Entrada inválida (JSON quebrado, campo ausente, curinga, validade acima do máximo ou anterior à aprovação, duplicidade) faz o auditor falhar com `excecoes-invalidas`, sem aplicar nenhuma exceção. Arquivo ausente equivale a nenhuma exceção.
    - A exceção sem advisory correspondente é apenas informada.
- **Agrupamento:** os advisories são agrupados por identificador e pacote; cada par é listado e tratado, e pode receber exceção, separadamente.

## Onde roda

- **No PR:** o job `audit` do `pr-gate` roda somente quando o PR altera o que muda o veredito: `package.json`, `yarn.lock`, `scripts/audit-dependencies.mjs`, `scripts/dependency-audit-exceptions.json`, `scripts/lib/dependency-audit*.mjs` ou os workflows `pr-gate` e `dependency-audit`. O PR que não toca nesses arquivos não executa o job e não é bloqueado por advisory novo. Quando o job é pulado, o check obrigatório não falha; quando roda e falha, bloqueia.
- **Na main:** a rotina `dependency-audit.yml` roda nos dias 1 e 15 e pode ser disparada manualmente (somente depois de o arquivo existir na main). Usa permissão só de leitura e nenhum segredo. A falha aparece como execução vermelha no GitHub Actions; não há issue automática. Um advisory novo pode reprovar uma árvore que não mudou, e nenhum PR dispara nesse caso: a rotina é o que o detecta.
- **No hook local:** o pré-push roda o auditor quando os arquivos enviados casam o padrão de auditoria (ver [Desenvolvimento local](../operations/local-development.md#verificações-locais-antes-do-push)). Falha de registry só avisa; vulnerabilidade barra.
- **Fora dos agregados de teste:** `yarn test:gates` e `yarn test:sdd` não executam a auditoria, porque o veredito muda sem mudança de código.

## Diagnósticos

Além das categorias de falha de execução do próprio auditor, o resultado distingue:

- `registry-indisponivel`: o Yarn não conseguiu consultar o registry; o veredito não foi emitido, não é vulnerabilidade e a execução deve ser repetida. No gate remoto, falha de registry reprova (falha fechada); no hook local, só avisa. O marcador é estável e o hook depende dele: se o texto mudar, o hook passa a barrar (lado seguro).
- `excecoes-invalidas`: o arquivo de exceções é inválido (ver acima).

## Limitação do Yarn 1

A auditoria depende do endpoint legado `/-/npm/v1/security/audits` do registry. Se ele for aposentado, o gate falha como `registry-indisponivel` até haver outro auditor.

## Workspaces

O auditor lê o `package.json` e o arquivo de exceções da raiz, e roda `yarn audit` a partir dela (um só lockfile cobre todo o monorepo Yarn 1). As raízes de **produção** são a **união das `dependencies` da raiz com as `dependencies` de cada workspace** (`apps/web`, `apps/server`, `packages/core`); as `devDependencies` — da raiz e de qualquer workspace — seguem como **tooling**. Num monorepo a produção vive nos pacotes, não na raiz: ler só a raiz classificaria toda a produção como tooling e enfraqueceria a política. O objeto `dependencies` da raiz DEVE existir, mesmo vazio. Um padrão de `workspaces` sem pacote no disco é ignorado, sem inventar raízes. Dependências de produção que tocam frames de webcam ou chaves de provedor seguem também o guia de [privacidade e segredos](privacy-and-secrets.md).
