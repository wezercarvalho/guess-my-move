# Como contribuir

O Guess My Move recebe contribuições com código, documentação, sugestões de usabilidade e relatos de testes com câmera real. Você não precisa alterar código para ajudar.

## Reportar um problema ou sugerir uma melhoria

Pesquise as [issues existentes](https://github.com/wezercarvalho/guess-my-move/issues) antes de abrir uma nova. Use o template para descrever o problema, o resultado esperado, o escopo e critérios que permitam conferir a solução.

Em um bug, informe o jogo e modo, passos para reproduzir, resultado atual e esperado, navegador, sistema operacional e condições relevantes da câmera. Para problemas online, diga em qual participante e etapa a falha apareceu. Separe o que observou de possíveis causas.

Prefira descrições e capturas sem dados pessoais. Não publique imagens de câmera, rostos, landmarks, credenciais de sala ou logs com esses dados. Uma medição de desempenho deve indicar o dispositivo e como foi obtida; uma experiência isolada não comprova precisão ou desempenho geral.

## Preparar uma alteração

1. Siga a [instalação no README](../README.md#executar-localmente). Colaboradores externos podem trabalhar em um fork.
2. Crie uma branch a partir da `main` atualizada, por exemplo `fix/descricao`, `feat/descricao` ou `docs/descricao`.
3. Instale o hook local antes do primeiro push:

    ```sh
    node scripts/git-hooks/install.mjs
    ```

4. Consulte o [roteador de estratégias](development-strategies/README.md). Ajustes pequenos de texto podem ser feitos diretamente; alterações em regras, contratos, câmera, dados pessoais ou infraestrutura exigem o fluxo de especificação indicado no guia.
5. Implemente uma mudança de escopo claro, preservando alterações alheias. Use commits convencionais em português, como `docs(readme): atualizar instruções de instalação`.

O [índice de contexto técnico](development-context/README.md) reúne os guias aplicáveis. O [AGENTS.md](../AGENTS.md) contém o roteamento compartilhado para pessoas e agentes de desenvolvimento.

## Validar

Para mudanças de código, execute na raiz:

```sh
yarn check:all
```

Para documentação:

```sh
yarn docs:format:check
```

Se alterar specs, use também `yarn test:sdd` e `yarn sdd:check`. O hook seleciona verificações pelo escopo do push; o CI continua obrigatório. Consulte os [checks de qualidade](development-context/quality/quality-gates.md) e o [guia do hook local](development-context/operations/local-development.md).

Em alterações de reconhecimento ou câmera, registre separadamente testes automatizados e testes com câmera real. Descreva limitações e o que ainda precisa ser conferido; não afirme precisão, FPS ou latência sem medição.

## Enviar uma pull request

Abra a PR como rascunho contra `main`. Explique o problema e o resultado da alteração, vincule a issue quando existir e informe as verificações executadas e pendências. Marque como pronta uma vez, quando a entrega estiver revisável. O check obrigatório `pr-gate / gate` precisa ficar verde antes do merge.

Use `Closes` apenas quando a entrega concluir a issue; para uma entrega parcial, use `Refs` e descreva o que falta. O [guia de issues e PRs](development-context/workflow/github-issues.md) detalha o fluxo e a responsabilidade pela revisão.

## Fronteiras do projeto

Mantenha o processamento de mãos e rosto no navegador. Não envie nem persista imagens, vídeos ou landmarks. O servidor de bolinhas recebe apenas os dados necessários à sala e à partida. Nunca adicione segredos ao repositório ou ao bundle web.

O critério interno de avaliação das cartas não pode aparecer na projeção pública para o jogador ou uma futura IA jogadora. Preserve os contratos e os testes dessa separação.

O código é MIT; dados, fontes e modelos de terceiros têm licenças próprias. Consulte as [atribuições do README](../README.md#licença-e-atribuições) antes de adicionar ou redistribuir ativos.
