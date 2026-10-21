# Guia de arquitetura

Princípio: **abstração mínima e provedor-independente**, sem infraestrutura antecipada. Este guia complementa a seção 7 do [`PROJECT_SPEC.md`](../../product/PROJECT_SPEC.md); em divergência, a spec aprovada prevalece.

## Camadas

| Camada                             | Responsabilidade                                                                             | Não deve                                               |
| ---------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Aplicação web (React + Vite + TS)  | Carta, câmera, captura temporária de frames, tentativas e resultado.                         | Conter chave de provedor.                              |
| Servidor mínimo (NestJS + TS)      | Proteger credenciais, validar payload, limites, timeout, converter falhas em erros estáveis. | Registrar mídia; expor detalhes internos do provedor.  |
| Adaptador do adivinhador           | Montar a requisição ao provedor e validar uma saída estruturada com um único palpite.        | Receber palavra, dica, sugestão, aliases ou critérios. |
| Árbitro semântico (fase posterior) | Normalização + canônico/aliases; LLM opcional só para ambiguidade.                           | Analisar a webcam.                                     |
| Motor da partida (fase posterior)  | Máquina de estados, tentativas e histórico de palpites rejeitados.                           | Tratar palpite correto como prova visual de execução.  |

## Stack decidida

Decisão do maintainer em 2026-10-21; as versões exatas são fixadas e registradas na issue de scaffold (#3), e o `PROJECT_SPEC.md` registra a proposta original.

- **Linguagem:** TypeScript no frontend e no servidor.
- **Frontend:** React + Vite.
- **Servidor:** NestJS na última versão estável, com a mesma interface `GuesserProvider` injetada como provedor (um módulo por adaptador, selecionado por configuração). Mantenha o servidor mínimo: sem módulos além dos que a PoC usa.
- **Banco de dados:** não há na PoC (cartas em JSON ou TypeScript versionado; frames transitórios). Se uma fase posterior exigir persistência, a escolha é TypeORM na última versão estável com `@nestjs/typeorm`; a introdução passa por spec própria e não antecipa dependência nem migrations.

### Versões fixadas e toolchain (TypeScript 7 com Oxlint)

As versões exatas foram fixadas no scaffold (issue #3) e atualizadas na adoção da toolchain: `react`/`react-dom` 19.3.1, `vite` 8.3.4, `@vitejs/plugin-react` 6.1.2, `@nestjs/*` 12.2.0 (config 12.0.1), `reflect-metadata` 0.2.2, `rxjs` 7.8.2, `zod` 4.6.7, `vitest` 5.0.5, `typescript` 7.0.2, `oxlint` 1.89.0 com `oxlint-tsgolint` 7.0.2004, e `@swc/core` 1.16.18 + `unplugin-swc` 2.0.0 para preservar os metadados de decorators do NestJS sob o Vitest.

**TypeScript 7 (compilador nativo).** O 7.0 não expõe a API programática do compilador. Por isso o `typescript-eslint` e o `nest build` não funcionam com ele. O projeto resolve assim:

- **Lint:** `oxlint` com `oxlint-tsgolint` (type-aware, sobre o `typescript-go`) no lugar do ESLint; a configuração fica em `.oxlintrc.json`. A versão do `oxlint-tsgolint` acompanha a do TypeScript (`7.0.2004` é o patch 2004 para o TypeScript 7.0.2).
- **Build do servidor:** `tsc -p tsconfig.build.json` direto (script `build` do servidor); o `tsc` 7 emite `design:paramtypes` para os decorators do NestJS. O `nest build` e o `nest start` não são usados; `yarn dev:server` roda `apps/server/scripts/dev.mjs` (`tsc --watch` mais `node --watch`). O `@nestjs/cli` foi removido; ele volta quando o TypeScript 7.1 estabilizar a API (prevista para novembro de 2026).
- **Testes:** o Vitest continua usando SWC para os decorators, independente da versão do TypeScript.

## Contrato mínimo do adivinhador

```ts
type CapturedFrame = { timestampMs: number; mimeType: string; data: string }
type GuesserInput = { frames: CapturedFrame[]; rejectedGuesses?: string[] }
type GuesserResult = { guess: string; insufficientEvidence?: boolean }

interface GuesserProvider {
    readonly id: string
    guess(input: GuesserInput, signal?: AbortSignal): Promise<GuesserResult>
}
```

Trocar de modelo (por exemplo, entre provedores de IA) significa adicionar um `GuesserProvider` e mudar configuração, sem tocar na UI, na captura nem no motor. O `MockGuesserProvider` é obrigatório. O contrato é um exemplo: ajuste nomes na spec, não a fronteira de informação.

## Regras

- Saída do modelo sempre validada por schema; respostas vazias, fora de formato ou sem evidência viram erro controlado ou "sem evidência suficiente".
- `confidence` autodeclarada por LLM não é probabilidade calibrada e não é garantia de reconhecimento.
- Prompt do adivinhador é genérico: pede uma hipótese curta da ação predominante nos frames em ordem cronológica e não contém a palavra-alvo nem sinônimos.
- Configuração do provedor (modelo, região, limites) vem do ambiente, não do código.

## Validação e contratos de dados

- **Fonte única:** os schemas do contrato (frame, requisição e resposta de `POST /api/guess`, erro estável e carta) vivem em `packages/core/src/schemas/` e usam Zod Mini (`zod/mini`), a API funcional e tree-shakable do Zod, por causa do bundle do navegador. Os tipos TypeScript são derivados dos schemas (`z.infer`); não duplique tipos à mão.
- **Objetos estritos:** campo não declarado invalida a requisição e a carta. Dado da carta no corpo de `/api/guess` é recusado com `invalid_payload`, o que reforça a fronteira de informação.
- **Servidor (NestJS 12):** a rota usa o `GuessRequestPipe`, que estende o `StandardSchemaValidationPipe` nativo: valida a estrutura com `guessRequestSchema` e depois confere os limites vindos da configuração com `checkGuessLimits` (função pura, em `core`). Estrutura inválida vira `invalid_payload` 400; excesso de frames ou bytes vira `payload_too_large` 413. O parser JSON usa um limite derivado de `MAX_TOTAL_BYTES`, e não o padrão de 100 kB do Express.
- **Ambiente:** as variáveis são validadas por um schema Zod passado ao `validationSchema` do `@nestjs/config`; valor inválido derruba o boot. O servidor usa o Zod clássico só nesse schema (coerção e padrões).
- **Cliente web:** valida a resposta 200 com `guessResponseSchema` e o erro com `apiErrorSchema`; resposta fora do contrato vira `invalid_model_response`.
- **Decisão pendente:** autenticação e limite por cliente do endpoint não fazem parte desta mudança.
