# Clarificação — 2026-10-31-game-arranha-teia-refine-fluid-layout-and-feedback

## Contexto

- **Spec:** `spec.md`
- **Status de entrada:** `specified`
- **Constituição:** 1.0.0
- **Iniciada em:** `2026-10-31`

## Log de decisões

### CQ-001 — Onde ficam as mensagens

**Pergunta:** onde mostrar os avisos sem cobrir a visão?

**Decisão:** na base do palco, centralizadas na horizontal, com fundo escuro translúcido. O topo esquerdo já tem os medidores (velocidade, altura, teia) e as miras da teia ficam perto do centro e do alto. A base mostra o horizonte baixo e o chão, a região menos útil da vista. O maintainer pediu "só não pode ser bem no centro da tela".

### CQ-002 — Estado persistente ou aviso passageiro

**Decisão:** estados que duram (direção travada, agarrado, espera de escalada, rosto fora do quadro, dica de parede) são chips que acompanham o estado. Eventos pontuais (direção liberada, soltou da parede, teia presa ou solta, rosto detectado) são avisos de 1,6 s. Travar e agarrar não geram aviso próprio porque o chip já aparece.

### CQ-003 — Sem rolagem, mas sem esconder coisas

**Decisão:** o palco ocupa o espaço restante e a coluna lateral rola sozinha se não couber. A legenda de teclado continua sempre visível (regra herdada do #80). "Como jogar" fica numa seção recolhível, aberta por padrão, e a depuração vira gaveta sobre o jogo.

### CQ-004 — Limiar do layout

**Decisão:** o layout fluido vale a partir de 960 px de largura e 560 px de altura. Abaixo disso empilha e a página rola. O maintainer pediu rolagem só onde necessário para responsividade.

### CQ-005 — Modo treino

**Decisão:** fora desta spec. O maintainer pediu uma issue em Ready (#108); este feedback é dependência dela.

## Gate 1 — Clarificação aprovada

- **Status:** aprovado
- **Aprovador:** wezercarvalho (maintainer)
- **Data:** `2026-10-31`
- **Artefatos aprovados:** `spec.md`, `clarification.md`
- **Referência:** mensagem do maintainer na sessão de 2026-10-31 ("Vamos melhorar o layout da tela. Podemos ocupar melhor o espaço da tela do game... Poderiam aparecer mensagens na tela quando a direção travar ou eventos relevantes... Pode considerar os gates aprovados. Me avisa quando eu puder testar.")
- **Observações:** o maintainer deu o escopo e considerou os gates aprovados. Os valores de jogo (1,6 s, três avisos, 960 × 560 px) são decisões do agente, ajustáveis após o teste.
