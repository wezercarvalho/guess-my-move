# Guia de arquitetura

Princípio: **abstração mínima e provedor-independente**, sem infraestrutura antecipada. Este guia complementa a seção 7 do [`PROJECT_SPEC.md`](../../product/PROJECT_SPEC.md); em divergência, a spec aprovada prevalece.

## Camadas

| Camada | Responsabilidade | Não deve |
| --- | --- | --- |
| Aplicação web (React + Vite + TS) | Carta, câmera, captura temporária de frames, tentativas e resultado. | Conter chave de provedor. |
| Servidor mínimo (Node.js + TS) | Proteger credenciais, validar payload, limites, timeout, converter falhas em erros estáveis. | Registrar mídia; expor detalhes internos do provedor. |
| Adaptador do adivinhador | Montar a requisição ao provedor e validar uma saída estruturada com um único palpite. | Receber palavra, dica, sugestão, aliases ou critérios. |
| Árbitro semântico (fase posterior) | Normalização + canônico/aliases; LLM opcional só para ambiguidade. | Analisar a webcam. |
| Motor da partida (fase posterior) | Máquina de estados, tentativas e histórico de palpites rejeitados. | Tratar palpite correto como prova visual de execução. |

## Contrato mínimo do adivinhador

```ts
type CapturedFrame = { timestampMs: number; mimeType: string; data: string };
type GuesserInput = { frames: CapturedFrame[]; rejectedGuesses?: string[] };
type GuesserResult = { guess: string; insufficientEvidence?: boolean };

interface GuesserProvider {
  readonly id: string;
  guess(input: GuesserInput, signal?: AbortSignal): Promise<GuesserResult>;
}
```

Trocar de modelo (por exemplo, entre provedores de IA) significa adicionar um `GuesserProvider` e mudar configuração, sem tocar na UI, na captura nem no motor. O `MockGuesserProvider` é obrigatório. O contrato é um exemplo: ajuste nomes na spec, não a fronteira de informação.

## Regras

- Saída do modelo sempre validada por schema; respostas vazias, fora de formato ou sem evidência viram erro controlado ou "sem evidência suficiente".
- `confidence` autodeclarada por LLM não é probabilidade calibrada e não é garantia de reconhecimento.
- Prompt do adivinhador é genérico: pede uma hipótese curta da ação predominante nos frames em ordem cronológica e não contém a palavra-alvo nem sinônimos.
- Configuração do provedor (modelo, região, limites) vem do ambiente, não do código.
