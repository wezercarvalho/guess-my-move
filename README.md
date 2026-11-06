# Guess My Move

**Jogos de movimento no navegador, com visão computacional local.**

Use a webcam para jogar cartas de gestos, bolinhas de gude e se movimentar entre prédios no Arranha-Teia. O Guess My Move é um projeto open source em TypeScript: o MediaPipe detecta mãos e rosto no próprio navegador, e os núcleos dos jogos transformam esses sinais em ações.

[Começar](#executar-localmente) · [Como jogar](docs/games.md) · [Contribuir](docs/contributing.md) · [Issues](https://github.com/wezercarvalho/guess-my-move/issues) · [Licença MIT](LICENSE)

## Jogos disponíveis

| Jogo                 | Experiência                                                                                                                                                           | Página          |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| **Cartas de gestos** | Faça o gesto pedido pela carta antes de acabar a rodada. O gesto disponível é **Acenar**.                                                                             | `/cards.html`   |
| **Bolinhas de gude** | Modos **Bete**, **Triângulo** e **Cova**, com tiro por pinça ou estalo experimental. Jogue localmente contra a meta ou o bot, ou online com outra pessoa.             | `/marbles.html` |
| **Arranha-Teia**     | Lance teias, balance e escale usando mãos e cabeça. Aprenda no **Treino**, em Aurora, ou explore cidades reais no modo **Viajante**. Também há controles por teclado. | `/swing.html`   |

O menu inicial reúne os três jogos. No multiplayer de bolinhas, a sala mostra apelidos, participantes, prontidão, vez atual, próximo jogador e resultado. As duas pessoas podem confirmar uma nova partida na mesma sala.

**Estado do projeto:** experimental e em desenvolvimento ativo. Compatibilidade de referência: Chrome desktop com webcam. Reconhecimento, calibragem e desempenho ainda precisam de validação em diferentes pessoas, dispositivos e condições de iluminação; os testes automatizados não substituem esses testes com câmera real. Uma IA jogadora que adivinha mímicas é uma possibilidade futura, não uma funcionalidade atual.

## Executar localmente

Requisitos: Git, **Node.js 26.12.1 ou superior da linha 26** (ver [`.node-version`](.node-version)), **Yarn 4.18.1** e Chrome desktop. A câmera exige permissão do navegador e um contexto seguro: `localhost` no desenvolvimento ou HTTPS na hospedagem.

```sh
git clone https://github.com/wezercarvalho/guess-my-move.git
cd guess-my-move
npm install --global corepack@0.36.0
corepack enable
yarn install --immutable
yarn dev:web
```

O Corepack é instalado explicitamente para preparar o Yarn. Abra o endereço exibido pelo Vite, normalmente `http://localhost:5173`, e escolha um jogo.

Na primeira execução, o script prepara o WebAssembly e baixa os modelos do MediaPipe com verificação de SHA-256. Esse preparo precisa de internet; execuções seguintes reutilizam os arquivos em cache. Os modelos são servidos pelo próprio app e não são versionados no Git.

### Jogar bolinhas online

Com o frontend em execução, abra outro terminal na raiz do projeto:

```sh
yarn dev:server
```

1. Abra `/marbles.html`, selecione **Online**, informe um apelido e crie uma sala no modo desejado.
2. A outra pessoa informa seu próprio apelido e entra pelo código da sala.
3. Ambas confirmam **Estou pronto**. A interface indica quem joga e quem será o próximo; a câmera é usada para atirar na própria vez.
4. Ao terminar, ambas confirmam a revanche para jogar novamente na mesma sala.

Para testar em uma máquina, use dois contextos de navegador separados. Salas comportam duas pessoas e ficam na memória de uma única instância do servidor. Uma desconexão pausa a partida por até 60 segundos; a credencial temporária da aba permite retomá-la após reconectar ou recarregar. Sair da sala a encerra; reiniciar o servidor perde as salas. Salas sem atividade expiram: por padrão, após 5 minutos em espera, 15 minutos durante a partida ou 5 minutos após o resultado. A janela de reconexão continua sendo de 60 segundos.

O servidor aceita, por padrão, as origens locais da porta 5173. Se o Vite usar outra porta ou você configurar hospedagem, ajuste `ALLOWED_ORIGINS`; confira os [limites e a configuração de proxy](docs/development-context/operations/local-development.md#limites-e-operação-do-multiplayer).

O Vite encaminha `/socket.io` e `/api` para `127.0.0.1:3000`. Para acesso em outros dispositivos, é necessário configurar HTTPS, a origem compartilhada entre web e servidor e suporte a WebSocket. Os comandos acima iniciam o ambiente local; não publicam uma instância na internet. Veja o [guia de desenvolvimento local](docs/development-context/operations/local-development.md).

## Privacidade por arquitetura

- **Mãos e rosto são processados no navegador.** Imagens, vídeos e landmarks não são enviados ao servidor, gravados ou registrados em logs.
- A câmera depende da permissão explícita do navegador, com indicador de captura e opção de pará-la.
- O modo local funciona sem o backend de multiplayer e sem chaves de provedores de IA.
- No online, o servidor recebe apelidos efêmeros, acesso e comandos da sala, tiros e estado da partida. Não há contas nem banco de dados; a credencial de retomada fica em `sessionStorage`.

Detalhes: [privacidade e segredos](docs/development-context/security/privacy-and-secrets.md).

## Estrutura e tecnologias

| Diretório                              | Responsabilidade                                                                         |
| -------------------------------------- | ---------------------------------------------------------------------------------------- |
| [`apps/web`](apps/web)                 | Interface React + Vite, visão local com MediaPipe e cena 3D com Three.js.                |
| [`apps/server`](apps/server)           | NestJS com HTTP nativo + Socket.IO: salas, estado autoritativo das partidas e reconexão. |
| [`packages/core`](packages/core)       | Contratos, cartas, avaliação de gestos e rodadas.                                        |
| [`packages/marbles`](packages/marbles) | Física 2D, tiros e regras das bolinhas.                                                  |
| [`packages/swing`](packages/swing)     | Física 3D, teias, escalada e lógica do olhar.                                            |

Os núcleos são TypeScript puro: não dependem de DOM, câmera ou rede. Essa separação permite testar regras e física sem acessar uma webcam. Consulte o [guia de arquitetura](docs/development-context/architecture/architecture-guide.md).

## Desenvolvimento e contribuição

Antes do primeiro push, instale o hook local com `node scripts/git-hooks/install.mjs`.

Contribuições com correções, documentação e relatos de testes são bem-vindas. Comece pelo [guia de contribuição](docs/contributing.md): ele explica como reportar problemas, preparar o ambiente e enviar uma PR.

| Comando                      | Uso                                             |
| ---------------------------- | ----------------------------------------------- |
| `yarn dev:web`               | Preparar modelos e iniciar o frontend.          |
| `yarn dev:server`            | Iniciar o servidor opcional de bolinhas online. |
| `yarn check:static`          | Verificar tipos e lint.                         |
| `yarn test`                  | Executar os testes dos workspaces.              |
| `yarn build`                 | Compilar todos os workspaces.                   |
| `yarn check:all`             | Executar tipos, lint, testes e build.           |
| `yarn docs:format:check`     | Verificar a formatação da documentação.         |
| `yarn security:dependencies` | Auditar dependências.                           |

Para visualizar o frontend compilado, execute `yarn build` e depois `yarn workspace @guess-my-move/web preview`. O preview não inicia o servidor de multiplayer.

## Documentação

- [Como jogar e ajustar a câmera](docs/games.md)
- [Contratos HTTP/eventos e observabilidade](docs/development-context/contracts/backend-api.md)
- [Como contribuir](docs/contributing.md)
- [Produto e escopo](docs/product/PROJECT_SPEC.md)
- [Contexto técnico: arquitetura, qualidade, CI e operações](docs/development-context/README.md)
- [Estratégias de desenvolvimento](docs/development-strategies/README.md) e [catálogo de specs](specs/README.md)
- [Pesquisa sobre uma futura IA jogadora](docs/research/multimodal-model-selection.md)
- [Orientações para agentes de desenvolvimento](AGENTS.md)

## Licença e atribuições

O código do projeto é distribuído sob a [licença MIT](LICENSE). Copyright (c) 2026 Wezer Carvalho.

Dados das cidades reais vêm dos colaboradores do **OpenStreetMap**, sob **ODbL**, com atribuição exibida no jogo. As fontes locais incluem seus avisos **OFL** em [`apps/web/src/design/fonts`](apps/web/src/design/fonts). Dependências e dados de terceiros mantêm suas próprias licenças.

A licença dos arquivos de modelo `.task` baixados pelo preparo de ativos ainda precisa de confirmação na fonte antes de sua redistribuição. A licença MIT do código não substitui essa verificação; consulte a [política de arquivos do detector](docs/development-context/security/privacy-and-secrets.md#arquivos-do-detector).
