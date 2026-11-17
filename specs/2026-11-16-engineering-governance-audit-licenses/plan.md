# Plano

## Constitution Check — pré-design

- PASS: escopo e privacidade preservados, direitos de terceiros não presumidos.
- PASS: lacunas de documentação confirmadas na base.

## Design

Inventariar o lockfile com YAML já instalado, cruzar com manifests e avisos das cópias em node_modules sem executar código de dependências, identificar candidatos diretos/transitivos e peers conservadoramente. Manter lacunas por plataforma, patch, licença e aviso. Gerar avisos no build web e índice, página local e crédito ODbL vinculados; manter política de release não automatizada e documentação das fontes. Testar fixtures, links, checks existentes e bytes de avisos. Não adicionar novo job ou scanner externo.

Alternativa rejeitada: inferir todos os termos pelo SPDX ou pela licença do repositório upstream. Isso não prova alcance de um bundle, aviso ou dependência efetivamente redistribuída. Não bloquear build de desenvolvimento nem publicar artefatos.

## Constitution Check — pós-design

- PASS: escopo, licença MIT, contratos e autoridade de merge mantidos.
- LIMITAÇÃO: suíte oficial e hook local indisponíveis; evidências oficiais via CI. Não é parecer jurídico.

## Estratégia de testes

RED por inspeção da base: não existia inventário, nem link de licença na entrada web, nem inclusão explícita dos notices OFL no build. Testes de regressão introduzidos para versões, transitive scope, ausência de licença/aviso e links. O CI deve demonstrar GREEN real.
