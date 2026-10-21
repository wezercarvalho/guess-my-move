# @guess-my-move/providers

Adaptadores do contrato `GuesserProvider` (de `@guess-my-move/core`) da PoC
Guess My Move. Seleção por configuração: trocar de provedor é configuração mais
um adaptador novo, sem tocar na UI, na captura nem na rota.

**Fronteira de informação inviolável:** nenhum provedor recebe dados da carta
(palavra, dica, sugestão, resposta canônica, aliases ou critérios). A entrada é
apenas `GuesserInput` (frames + palpites rejeitados).

## Provedores

| Provedor | Id      | Credencial | Uso                                                  |
| -------- | ------- | ---------- | ---------------------------------------------------- |
| `mock`   | `mock`  | nenhuma    | Desenvolvimento e testes; palpite determinístico.    |
| `codex`  | `codex` | sessão CLI | Primeiro provedor real; só local, desligado por padrão. |

### `MockGuesserProvider`

Determinístico e sem rede. Configurável para devolver um palpite fixo,
`insufficientEvidence`, um erro simulado ou um atraso (para exercitar timeout e
cancelamento via `AbortSignal`).

### `CodexGuesserProvider`

Chama o Codex CLI (`codex exec`) em modo não interativo com os frames como
imagens ordenadas. Garantias:

- **uma execução por vez** (fila serial por instância);
- diretório de trabalho temporário **vazio, somente leitura** (`-s read-only`),
  fora de um repositório Git (`--skip-git-repo-check`, `-C <dir>`), sem persistir
  sessão (`--ephemeral`);
- **timeout** configurável com `kill` do processo;
- **limpeza sempre** dos arquivos temporários (sucesso, erro ou timeout);
- saída estruturada validada por schema (`--output-schema`, lida de `-o`).

Desligado por padrão: só é registrado quando `GUESSER_PROVIDER=codex`.

Configuração por ambiente:

| Variável                 | Descrição                                      |
| ------------------------ | ---------------------------------------------- |
| `CODEX_BIN`              | Binário do Codex CLI (padrão `codex`).         |
| `CODEX_MODEL`            | Modelo, ex.: `gpt-6-luna`.                      |
| `CODEX_REASONING_EFFORT` | `none`, `low` ou `high`.                        |

O prompt é **genérico**: pede a descrição da ação humana predominante nos frames
em ordem cronológica, sem palavra-alvo, dica, sugestão ou aliases. O prompt é
enviado por **stdin** (não como argumento posicional), porque `-i` é variádico
(`<FILE>...`) e consumiria um prompt posicional como mais uma imagem.

## Verificação empírica do Codex (2026-10-21)

Confirmada contra **`codex-cli 0.162.1`**, autenticado (assinatura ChatGPT do
mantenedor), com **3 imagens PNG sintéticas 64×64** geradas localmente por
script Node (sem rede), executando o próprio `CodexGuesserProvider`.

| Pergunta                                   | Resultado                                                                 |
| ------------------------------------------ | ------------------------------------------------------------------------- |
| Aceita várias imagens por execução?        | **Sim.** 3 imagens ordenadas via `-i <a> <b> <c>` (flag variádica).       |
| O modelo `gpt-6-luna` está disponível?     | **Sim.** `-m gpt-6-luna` executou sem erro de modelo.                     |
| O esforço de raciocínio é aceito?          | **Sim.** `-c model_reasoning_effort=low` aceito; `none`/`high` análogos.  |
| A saída estruturada funciona?              | **Sim**, após ajuste do schema (veja abaixo).                             |

**Resultado da chamada real** (`effort=low`, 3 frames, ~3,5 s de ponta a ponta
pela CLI): `{ "guess": "Movendo o braço para cima e para baixo.",
"insufficientEvidence": false }` — descrição genérica coerente com o movimento
do braço nos frames sintéticos, sem citar nenhuma palavra de carta.

**Ajuste necessário (descoberta empírica):** a saída estruturada da OpenAI
recusa um schema cujo `required` não inclua **todas** as propriedades de
`properties` (erro `invalid_json_schema`, HTTP 400). Por isso o
`guesserResultJsonSchema` marca `guess` **e** `insufficientEvidence` como
obrigatórios; o modelo ainda pode devolver `insufficientEvidence: false`. O
parser (`parseGuesserResult`) mantém `insufficientEvidence` opcional no tipo TS.

**Ordem do prompt (descoberta empírica):** passar o prompt como argumento
posicional após `-i` fez a CLI tratá-lo como imagem ("No prompt provided via
stdin"). A solução foi enviar o prompt por **stdin** e deixar `-i` por último.

**Decisão sobre fallback:** como as quatro perguntas foram confirmadas, **não** é
necessário recorrer à API da OpenAI como fallback nesta fase. Se em uma máquina
o `gpt-6-luna` não estiver disponível no Codex CLI, ou a saída estruturada deixar
de ser aceita, o fallback previsto na spec é a API da OpenAI (issue futura).

**Limitações:** a latência medida pela CLI **não** representa a latência de
produção (inclui a inicialização do processo e a camada de agente) — ver SC-004.
Esta verificação não é um benchmark de acurácia (máximo de 3 chamadas reais, sem
clipes reais).

## Testes

`yarn workspace @guess-my-move/providers test` — tudo com `mock` e com um
executável simulado do Codex (script Node), **sem** chamadas pagas ao Codex. A
suíte cobre sucesso, timeout, saída inválida/vazia, código de saída ≠ 0, limpeza
dos temporários, concorrência serial e ausência de dados da carta.
