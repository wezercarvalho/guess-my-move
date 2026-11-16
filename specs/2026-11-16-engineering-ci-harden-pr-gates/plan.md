# Plano

## Resumo técnico

Modificar os três workflows existentes, seleção de paths, leitores locais, testes estruturais, CODEOWNERS e documentação, preservando o nome do required check.

## Constitution Check — pré-design

- PASS: escopo aprovado, autoridade humana e fronteira de confiança preservadas.
- PASS: lacunas de política observadas na main; mudanças de código do produto desnecessárias.

## Decisões técnicas

- Releases oficiais confirmadas nas referências Git: checkout v4.4.0, commit `11d5960a326750d5838078e36cf38b85af677262`; setup-node v4.4.0, commit `49933ea5288caeca8642d1e84afbd3f7d6820020`. Preservar major e desabilitar persistência de credenciais.
- Manter permissões somente leitura, runners hospedados e limites de tempo nos jobs; auditorias somente na main.
- Comparar base com árvore de merge, usando nomes terminados por NUL, sem detecção de renomes. Falha de diff bloqueia; evitar logging de nomes brutos. Hook mantém intervalo local e seleção equivalente.
- Ampliar escopos com configuração Yarn/npm, atributos Git, Actions locais, manifests de workspaces e workflows. O pr-gate seleciona código completo quando alterado.
- Carregar o consolidador da base. O YAML ainda pode ser alterado por uma proposta, portanto o check não substitui revisão humana.
- CODEOWNERS identifica responsabilidade. Controles administrativos ficam para verificação humana.

## Estratégia de testes

RED observado por inspeção e asserções isoladas sobre a main: tags móveis nos três workflows, ausência de opt-out de credenciais, configuração Yarn fora dos escopos e consolidador executado a partir da proposta. Adicionar testes estruturais de regressão, ampliar amostras e fixtures do hook. A execução oficial depende de CI remoto; não declarar a suíte local executada.

## Rastreabilidade

FR-001 e FR-002: T001–T002. FR-003: T003. FR-004: T004. FR-005: T005. T006 registra evidências de todos os requisitos.

## Constitution Check — pós-design

- PASS: controles existentes preservados, sem novas permissões, jobs ou segredos de produção.
- PASS: risco de alteração do próprio YAML e limites de CODEOWNERS explícitos.
- LIMITAÇÃO: não há checkout com dependências e runtime do projeto disponíveis neste ambiente. Validar pela execução remota.

## Riscos e rollback

Não integrar se houver falhas de CI; rollback deve ocorrer em PR revisada. Alterações futuras do consolidador são testadas no candidato, mas entram em uso no gate somente após integração. Revisão humana é indispensável para mudanças da definição do gate; controles independentes que exijam organização ou serviços adicionais estão fora desta entrega.
