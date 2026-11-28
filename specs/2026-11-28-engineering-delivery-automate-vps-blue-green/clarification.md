# Clarificação — Automatizar o deploy na VPS com blue-green e drenagem de salas

## Contexto

- **Spec:** [spec.md](spec.md)
- **Status de entrada:** `specified`
- **Constituição:** 1.0.0
- **Iniciada em:** `2026-11-28`

## Log de decisões

### CQ-001 — Continuidade e estratégia de publicação

- **Data:** `2026-11-28`
- **Impacto:** crítico
- **Pergunta:** Como a atualização encaminha tráfego enquanto há partidas?
- **Decisão:** A [issue do piloto](https://github.com/wezercarvalho/guess-my-move/issues/181) e o encaminhamento do mantenedor determinam blue-green, candidata privada e drenagem por sala. O convite e a reconexão são encaminhados pelo código da sala original. A recarga é aplicada na volta ao lobby.
- **Razão:** Os jogos retêm salas na memória e a página pode depender de arquivos da revisão anterior.
- **Alternativas rejeitadas:** Recriar o único processo encerra as partidas. Canary divide tráfego fora da fronteira de salas escolhida para o piloto.
- **Seções atualizadas em `spec.md`:** FR-003 a FR-006, US-002 e US-003.

### CQ-002 — Reversão e distribuição

- **Data:** `2026-11-28`
- **Impacto:** alto
- **Pergunta:** Qual recuperação o mantenedor pode esperar e o que o piloto pode publicar?
- **Decisão registrada:** Reverter novas salas sem recriação enquanto o slot anterior estiver disponível. Queda do processo pode perder as salas que ele mantém. Retenção das imagens permite recuperar uma versão após drenar. Preservar HTTPS, avisos e a política atual do piloto.
- **Razão:** A reversão de rota não recria estado de memória. A revisão de licenças segue na [issue #179](https://github.com/wezercarvalho/guess-my-move/issues/179).
- **Seções atualizadas em `spec.md`:** FR-007, FR-008, NFR-001, NFR-003, US-004.

## Hipóteses remanescentes

- Validar a revisão efetiva da VPS, o acesso à receita histórica, a compatibilidade da primeira troca e a capacidade de rodar dois slots. São insumos para o desenho e para a decisão de habilitar, registrados na spec.

## Gate 1 — Clarificação aprovada

- **Status:** aprovado
- **Aprovador:** mantenedor, Wezer Carvalho.
- **Data:** `2026-11-28`
- **Artefatos aprovados:** intenção da issue e decisões de voz, transcritas em [spec.md](spec.md) e em `clarification.md`.
- **Referência:** [issue #181](https://github.com/wezercarvalho/guess-my-move/issues/181) e autorização prévia do mantenedor comunicada no repasse da sessão de voz de 2026-11-28.
- **Observações:** A aprovação antecipada cobre as decisões já discutidas. O mantenedor reservou o teste de ponta a ponta e o aceite final para uma sessão conjunta. O registro não atribui ao mantenedor revisão posterior dos arquivos.
