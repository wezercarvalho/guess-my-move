# Segurança do runtime Node

A auditoria npm não verifica o binário Node. `yarn security:runtime` lê o pin exato de `.node-version`, consulta o [índice oficial de releases](https://nodejs.org/dist/index.json) e o [calendário oficial](https://github.com/nodejs/Release/blob/main/schedule.json), e compara versões estáveis da mesma major. Não instala, não modifica arquivos, não cruza major e não envia dados de jogo.

Uma versão marcada `security: true` posterior ao pin bloqueia; fim de suporte, pin não publicado, formato desconhecido ou falha de rede também reprovam, sem veredito de vulnerabilidade. Versão comum posterior é informativa. O resultado não declara o runtime livre de vulnerabilidades: avisos anunciados antes de um release continuam exigindo acompanhamento humano.

As URLs são fixas; redirects são recusados. Cada consulta tem timeout de 15 segundos e leitura de até 2 MiB, inclusive quando o servidor omite Content-Length. Testes sintéticos rodam em `yarn test:gates`, sem rede. A consulta real é separada.

## Onde roda

- PR pronta: passo do job `audit` no único workflow `pr-gate`; mudanças no pin, auditor, biblioteca, manifestos ou workflows relevantes selecionam essa verificação. Alterar o pin também seleciona o job de código com check:all.
- Pré-push: mesmo escopo, depois da auditoria npm; runtime falha fechado inclusive em erro de rede. Não usa a exceção de indisponibilidade do registry npm.
- Main: `runtime-audit.yml`, diariamente às 08:37 UTC e sob disparo manual, com `contents: read`, sem segredos e sem criar issues ou atualizar versões. Agendamento e botão manual só entram em operação depois do merge.

Uma execução vermelha precisa ser investigada pelo responsável do repositório. Não representa aplicação automática de correção, nem monitoração antes do merge.

## Atualização e responsabilidade

Responsável: **@wezercarvalho**. Próxima conferência extraordinária: **11/11/2026, horário de Brasília**, ou após se a publicação atrasar, conforme o [aviso oficial de novembro](https://nodejs.org/en/blog/vulnerability/november-2026-security-releases). O acompanhamento permanece na [issue #132](https://github.com/wezercarvalho/guess-my-move/issues/132).

1. Ler o advisory e a nota da versão publicada, confirmar quais majors e cenários são afetados; não inferir aplicabilidade só da severidade.
2. Confirmar a versão e artefatos oficiais. Atualizar `.node-version`, `engines.node`, ambientes/imagens pinados e documentação que declare o runtime, mantendo a faixa e a versão mínima coerentes. Workflows deste repositório usam o arquivo do pin.
3. Em branch/PR, instalar dependências com `yarn install --immutable` no novo Node; executar `yarn check:all`, `yarn contracts:check`, `yarn test:gates`, `yarn test:sdd`, `yarn sdd:check`, `yarn docs:format:check`, `yarn security:dependencies` e `yarn security:runtime`. Conferir início do servidor, entrada/retomada/revanche nos dois jogos e os contratos. Registrar versão, commit, comandos e limitações.
4. O maintainer revisa e integra. Confirmar runtime implantado separadamente: merge do pin não prova versão em produção. Rollback operacional depende da avaliação do advisory e não deve restaurar binário vulnerável sem decisão explícita.
5. Registrar evidências na issue e decidir seu encerramento apenas depois dos critérios completos. Falha de fonte oficial pede nova consulta; não afrouxar o gate ou marcar sucesso para contornar rede.

Na conferência de 06/11/2026, o pin é **26.12.1** e a última versão marcada security no índice é **26.12.1**. **26.13.0** é uma atualização de metadados LTS: a [nota oficial](https://nodejs.org/en/blog/release/v26.13.0) diz que não inclui outras mudanças em relação a 26.12.1. Não tratá-la como correção do advisory futuro. Esta entrega implementa rotina/procedimento; a atualização do patch publicado e a análise das CVEs continuam pendentes em #132.
