# Prontidão para releases do runtime e compilador

Conferência em **08/11/2026**, base `b9335d5dba89a606a795108f00865fed8e7f411f`. Responsável: **@wezercarvalho**. Este registro organiza o trabalho dependente de publicação externa; não declara as issues #52/#132 resolvidas nem altera pins, ferramentas ou gates.

## Node — #132

`yarn security:runtime` consultou os metadados oficiais e aprovou a consulta: pin **26.12.1**, estável mais recente na major **26.13.0**, última release marcada `security` **26.12.1**. Isso não atesta ausência de vulnerabilidades.

O [aviso oficial de novembro](https://nodejs.org/en/blog/vulnerability/november-2026-security-releases), conferido diretamente na origem, anuncia correções de severidade máxima alta para a linha 26, em **11/11/2026 ou depois**. O binário corretivo e seus detalhes ainda não estão disponíveis nesta conferência. Não há versão corretiva publicada que possa ser instalada/testada com honestidade agora.

A [nota de 26.13.0](https://nodejs.org/en/blog/release/v26.13.0) informa transição para LTS e atualização de metadados, sem mudanças adicionais de código em relação a 26.12.1. Trocar apenas para essa versão não resolve o aviso futuro.

O monitor da **PR #146 já foi mesclado**: o workflow diário/manual, verificação de PR/hook e [política de atualização](../security/runtime-node.md) estão na main. A descrição antiga de #132 que o tratava como draft precisa ser lida com essa atualização. Não se trata de instalar patches automaticamente.

Próxima conferência extraordinária: **11/11/2026, Brasília**, repetindo após a data se o release atrasar. Quando sair:

1. Ler advisory/notas/CVEs e registrar a aplicabilidade ao backend; não inferir explorabilidade apenas da severidade.
2. Atualizar o pin, engines, ambientes e documentação em conjunto, em branch; usar artefatos oficiais e verificar integridade.
3. Executar a matriz da política de runtime, com instalação imutável, código, contratos, sessões/retomada/revanche e servidor compilado no novo binário.
4. Abrir PR draft com evidências; confirmar a versão implantada separadamente do merge. Só então avaliar encerramento de #132.

## TypeScript/Nest CLI — #52

O [registry oficial do TypeScript](https://registry.npmjs.org/typescript) ainda publica **7.0.2** como `latest` e **7.1.0-beta** como `beta`; a tag `next` é **7.1.0-dev.20261107.1**. O [anúncio do beta](https://devblogs.microsoft.com/typescript/announcing-typescript-7-1-beta/) descreve APIs novas e separadas (`typescript/sync`, `typescript/async`, `typescript/fs`), não a restauração transparente da API antiga.

O [plano oficial](https://github.com/microsoft/TypeScript/issues/63703) prevê RC em **10/11/2026** e estável em **24/11/2026**. Datas de plano não são publicação comprovada. Próxima conferência de prontidão: **10/11/2026**; adoção somente após versão estável publicada e validada, com nova conferência em **24/11/2026** se necessário.

A [compatibilidade do Nest CLI](https://github.com/nestjs/nest-cli/issues/3479) permanece em aberto. Uma proposta ou commit citado na discussão não comprova release estável compatível. Manter o fluxo `tsc` e o launcher de desenvolvimento atuais até demonstrar compilação, watch, DI e metadados no projeto real.

Quando a versão estável existir:

1. Conferir as tags/versões exatas publicadas de TypeScript e `oxlint-tsgolint`; atualizar todos os manifestos/lockfile em conjunto, preservando instalação imutável.
2. Atualizar a spec `2026-10-21-engineering-toolchain-adopt-yarn4-oxlint-node26`, README e desenvolvimento local antes da migração de comportamento. Gates de execução foram autorizados; aceite final não está antecipado.
3. Executar `yarn check:all`, `yarn contracts:check`, `yarn test:gates`, SDD/docs e auditorias; comprovar o servidor **compilado pelo TypeScript**, não apenas a suíte transformada pelo SWC. Verificar respostas válidas e inválidas dos endpoints vigentes.
4. O endpoint antigo `/api/guess` já não existe na main atual. Seu antigo requisito 200/400 precisa ser reconciliado com as rotas atuais, preservando o objetivo de validar DI/metadados e recusa de payloads inválidos; não recriar uma API aposentada só para cumprir uma referência histórica.
5. Reavaliar Nest CLI em experimento separado usando a release exata e um teste de build/watch/DI/metadados. Se continuar incompatível, registrar resultado e manter `tsc`; não instalar shim ou beta por presunção.
6. Reavaliar a paridade de lint: `react/rules-of-hooks` é erro; `react/exhaustive-deps` e `react/only-export-components` são avisos na configuração atual. Checar diagnósticos reais, suporte às novas APIs e eventual React Compiler antes de alterar severidade ou adicionar outra ferramenta. Não afirmar paridade apenas por os nomes das regras coincidirem.
7. Documentar versões, decisões e limitações na PR draft. Só encerrar #52 depois da adoção estável, validações e revisão.

## Escopo e validação desta conferência

Mudança documental de baixo risco: SDD opcional pelo roteador, sem código de runtime ou dependências alterados. Fontes primárias conferidas, main e PR #146 verificadas no GitHub, consulta real `yarn security:runtime` aprovada. Formatação, catálogo e verificações leves do hook devem passar antes do push. Não substitui testes futuros com releases ainda indisponíveis.

As duas issues permanecem abertas. Esta entrega resolve a organização e a conferência atual; os critérios de atualização/adoção dos binários continuam bloqueados pelas respectivas publicações externas. Não usar `Closes` para este acompanhamento.
