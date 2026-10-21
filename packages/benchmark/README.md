# @guess-my-move/benchmark

Harness **offline** e reproduzível do benchmark do gesto "Acenar" (issue #10).
Lê um manifesto de clipes de um diretório **local, fora do Git**, executa contra
o provedor configurado (`mock` ou `codex`) e gera um relatório Markdown com
métricas por provedor/variante, intervalos de confiança (Wilson) e limitações.

Esta entrega é o **harness + protocolo + modelo de relatório**. A execução com
clipes reais depende de gravações feitas pelo mantenedor (com consentimento) e é
uma etapa manual posterior: o harness **não inventa números** e não deve ser
rodado com dados reais aqui.

## Clipes fora do Git

Os clipes e frames ficam **apenas locais**, fora do Git, apagáveis — a única
exceção à regra de não persistir frames, restrita ao benchmark. O `.gitignore`
deste pacote ignora `clips/`, `frames/`, imagens e `reports/`. Nunca versione
mídia.

## Formato do manifesto (JSON)

Um manifesto descreve os clipes de um diretório local. Os caminhos de frame são
relativos ao diretório do manifesto, em ordem cronológica.

```json
{
    "version": 1,
    "sample": {
        "people": 3,
        "environments": 2,
        "lightingConditions": 2,
        "notes": "consentimento escrito por pessoa"
    },
    "clips": [
        {
            "id": "p1-001",
            "scenario": "P1",
            "expected": "positive",
            "variant": "6f-640x480",
            "frames": ["p1-001/frame-000.jpg", "p1-001/frame-001.jpg"]
        },
        {
            "id": "n1-001",
            "scenario": "N1",
            "expected": "negative",
            "frames": ["n1-001/frame-000.jpg"]
        }
    ]
}
```

Cenários aceitos: `P1`–`P6` (positivos) e `N1`–`N5` (negativos), conforme a
seção 11 de `docs/research/multimodal-model-selection.md`. A `variant` agrupa
resultados (por exemplo, número de frames e resolução).

## Uso

> **Runtime.** Os pacotes `@guess-my-move/core` e `@guess-my-move/providers`
> expõem o código-fonte TypeScript como entrada (`main: src/index.ts`), seguindo
> o scaffold. Por isso o CLI compilado (`dist/cli.js`) precisa que esses pacotes
> também resolvam para `dist` em runtime (campo `exports` com condição de
> runtime) OU ser executado por um runtime TypeScript (ex.: `tsx`). Isso é uma
> configuração do monorepo, pendente no `core` (fora da propriedade deste
> pacote); a lógica do harness é validada pelos testes (`vitest`) e o build é
> verificado por `yarn build`.

```sh
# Modo mock (sem custo, sem rede):
yarn workspace @guess-my-move/benchmark build
node packages/benchmark/dist/cli.js \
  --manifest /caminho/local/clips/manifest.json \
  --provider mock \
  --out /caminho/local/reports/mock.report.md

# Modo codex (apenas local; latência NÃO representa produção):
node packages/benchmark/dist/cli.js \
  --manifest /caminho/local/clips/manifest.json \
  --provider codex --codex-model gpt-6-luna --codex-effort low \
  --timeout 120000 --out /caminho/local/reports/codex.report.md
```

Opções: `--cost <US$/tentativa>` (só quando conhecido, API paga),
`--timeout <ms>`, `--codex-model`, `--codex-effort none|low|high`.

## Visão x semântica

O julgamento de "acerto" é **determinístico** (normalização + aliases, ver
`semantics.ts`): separa a VISÃO (o modelo reconheceu a ação?) da SEMÂNTICA (o
texto casa com "acenar"?), sem LLM. Palpites genéricos como "levantar a mão"
**não** contam. O árbitro **oficial** do jogo vive em `@guess-my-move/core`; a
função local daqui é mínima e serve só ao benchmark.

## Métricas e honestidade

O relatório traz recall, precisão, acurácia, taxa de falso positivo (cada uma
com IC95% de Wilson e `n`), falsos positivos/negativos, "evidência insuficiente"
em positivos, falhas técnicas, latência mediana e p95 e custo por tentativa
(quando informado). **Não** declara taxa de acerto geral do produto. A latência
via Codex CLI é marcada como **não representativa** da produção (SC-004).

## Testes

`yarn workspace @guess-my-move/benchmark test` — dados sintéticos e provedor
`mock`, sem chamadas pagas.
