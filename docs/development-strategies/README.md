# Estratégias de desenvolvimento

Este diretório centraliza as estratégias consumidas por pessoas e agentes de IA. Estratégias descrevem como transformar uma intenção em uma mudança validada; padrões técnicos e runbooks reutilizáveis ficam em [`../development-context/`](../development-context/README.md).

## Estratégias disponíveis

| Estratégia                                     | Estado | Uso                                                      |
| ---------------------------------------------- | ------ | -------------------------------------------------------- |
| [Spec-Driven Development (SDD)](sdd/README.md) | Ativa  | Mudanças relevantes, ambíguas, transversais ou críticas. |

Não antecipe um fluxo ainda não documentado.

## Seleção por risco

Use o SDD obrigatoriamente quando a mudança afetar:

- a fronteira de informação da carta: o critério de avaliação nunca chega ao jogador nem a uma futura IA jogadora (`toPublicCard`);
- captura, transmissão ou armazenamento de imagens da webcam, ou qualquer dado pessoal;
- integração com provedor externo de IA, credenciais, custo ou limites de uso;
- contratos entre os núcleos puros dos jogos, o detector de mão e a interface;
- critérios de avaliação e regras dos jogos (critério tipado da carta, limiares do detector, tiro, política de acerto);
- infraestrutura, hospedagem ou deploy.

Use o SDD preferencialmente quando houver ambiguidade relevante, alternativas arquiteturais ou impacto em mais de um componente.

O SDD é opcional para alteração pequena, local, reversível e com comportamento evidente (ajuste de texto, estilo, refactor interno coberto por testes). Quando nenhuma estratégia atender, confirme a abordagem com o maintainer ou use SDD como fallback seguro.

## Roteamento

1. Classifique tipo, risco e áreas afetadas.
2. Selecione uma estratégia documentada.
3. Leia a constituição e o guia da estratégia.
4. Carregue no [índice de contexto](../development-context/README.md) somente as referências aplicáveis.
5. Localize ou crie a spec no [catálogo](../../specs/README.md).
6. Valide com os scripts oficiais de `package.json`.
