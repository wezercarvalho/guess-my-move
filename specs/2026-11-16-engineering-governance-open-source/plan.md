# Plano

## Constitution Check — pré-design

- PASS: intenção e limites autorizados; privacidade, licenciamento e autoridade do mantenedor preservados.
- PASS: documentos faltantes e configuração de checks confirmados na base.

## Design

- Criar os três arquivos da raiz, aproveitar guia canônico e incluir os links no README e templates.
- Orientar reportes de segurança ao mecanismo privado quando habilitado, com fallback sem detalhes públicos. Sem contato privado inventado ou promessa de atendimento.
- Ampliar a seleção SDD, root-docs e tooling em workflow e hook; estender os dois comandos de formatação. Acrescentar regressões em test:gates sem novos jobs.
- Preservar código, lockfile, licença e proteção de branch.
- Publicar em uma única PR com evidências, riscos e aceite final condicionado ao merge.

## Constitution Check — pós-design

- PASS: controles de segurança atuais preservados.
- PASS: documentação não substitui conferência administrativa.
- LIMITAÇÃO: execução oficial disponível via CI remoto; hook local e teste real de reporte privado não realizados.

## Testes e risco

RED estrutural: documentos inexistentes na árvore da base; os padrões e scripts de formatação não os selecionam. Adicionar testes de regressão e validar no CI real. Não alegar execução local da suíte.
