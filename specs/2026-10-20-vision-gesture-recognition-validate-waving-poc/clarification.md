# Clarificação — 2026-10-20-vision-gesture-recognition-validate-waving-poc

## Contexto

- **Spec:** `spec.md`
- **Status de entrada:** `specified`
- **Constituição:** `1.0.0`
- **Iniciada em:** `2026-10-21`

Resolve a issue #1 (metas, modelos e residência de dados da PoC visual). As decisões abaixo foram **definidas em 2026-10-21 pelo orquestrador sob aprovação geral do maintainer e são revisáveis**.

## Log de decisões

### CQ-001 — Metas exploratórias de acerto e falso positivo da PoC

- **Data:** `2026-10-21`
- **Impacto:** crítico
- **Pergunta:** Quais metas mínimas de acerto e falso positivo tornam a PoC bem-sucedida?
- **Decisão:** Metas **exploratórias** de amostra pequena, não taxa de acerto geral: recall **>= 80%** nos positivos P1–P6; falsos positivos **<= 10%** nos negativos N1–N5 e **nenhum** no N1 (pessoa parada).
- **Razão:** A PoC decide manter/ajustar/trocar o provedor, não anuncia acurácia de produto; o N1 é o piso de sanidade do reconhecimento.
- **Alternativas rejeitadas:** Taxa de acerto única (mistura visão e semântica e viola a constituição V); deixar sem meta (impede decisão objetiva no benchmark).
- **Seções atualizadas em `spec.md`:** `Critérios mensuráveis de sucesso` (SC-005), `Decisões de clarificação resolvidas`.

### CQ-002 — Metas de latência e custo por tentativa

- **Data:** `2026-10-21`
- **Impacto:** crítico
- **Pergunta:** Quais metas de latência e custo por tentativa, e com que fonte de medição?
- **Decisão:** Latência **medida via API** com **mediana <= 8 s** e **p95 <= 15 s**; custo por tentativa **<= US$ 0,01** em API paga. A latência do Codex CLI **não** vale para a decisão final (inclui inicialização do CLI e camada de agente).
- **Razão:** O Codex CLI não representa a latência de produção; a decisão de provedor precisa de medição comparável à operação real.
- **Alternativas rejeitadas:** Usar a latência do CLI como referência (não representativa, viola SC-004); adiar toda meta de latência para o provedor definitivo (deixa o benchmark sem critério operacional).
- **Seções atualizadas em `spec.md`:** `Critérios mensuráveis de sucesso` (SC-006, SC-004).

### CQ-003 — Perfil do benchmark e consentimento

- **Data:** `2026-10-21`
- **Impacto:** alto
- **Pergunta:** Número e perfil de pessoas e ambientes do benchmark, e consentimento para coleta?
- **Decisão:** **>= 3 pessoas**, **>= 2 ambientes**, **>= 2 condições de luz**; consentimento **escrito, simples e específico**; clipes só **locais, fora do Git**, apagáveis.
- **Razão:** Dá representatividade mínima sem transformar a PoC em estudo formal; respeita privacidade e a regra de não persistir frames (exceção restrita ao benchmark).
- **Alternativas rejeitadas:** Uma só pessoa/ambiente (amostra não informativa); versionar clipes no Git (viola privacidade e a constituição VI).
- **Seções atualizadas em `spec.md`:** `Perfil do benchmark`, `Decisões de clarificação resolvidas`.

### CQ-004 — Modelos da PoC e residência de dados

- **Data:** `2026-10-21`
- **Impacto:** crítico
- **Pergunta:** Qual par de modelos e qual perfil de inferência (`global` x `us`) a PoC usa?
- **Decisão:** PoC com o adaptador `codex` (`gpt-6-luna`, esforço `none`, `low`, `high`) e `mock` para testes. **Bedrock** (Claude Haiku 5.5 e Nova 2 Lite) vira **candidato de produção** em issue futura, dependente do acesso AWS (issue #2). A escolha `global` x `us` fica **adiada** até o acesso AWS ser configurado.
- **Razão:** Remove a dependência de AWS do caminho crítico da PoC; a residência de dados só é decidível quando o provedor de produção for ativado.
- **Alternativas rejeitadas:** Exigir Bedrock na PoC (bloqueia por acesso AWS); decidir `global` x `us` agora (prematuro sem conta AWS).
- **Seções atualizadas em `spec.md`:** `Estratégia de provedores da PoC`, `Fora de escopo`, `Decisões de clarificação resolvidas`.

### CQ-005 — O que a PoC valida de acurácia

- **Data:** `2026-10-21`
- **Impacto:** alto
- **Pergunta:** A PoC conclui sobre acurácia por conta própria?
- **Decisão:** Não. O benchmark (issue #10) só roda com clipes reais gravados pelo maintainer; a entrega da #10 é o **harness reproduzível + protocolo + modelo de relatório**. Reaproveita o protocolo da seção 11 de `docs/research/multimodal-model-selection.md` e o `PROJECT_SPEC.md`.
- **Razão:** Evidência honesta e proporcional ao risco (constituição V); separa a entrega de engenharia da execução manual com dados reais.
- **Alternativas rejeitadas:** Declarar acurácia a partir de dados sintéticos do mock (inválido); bloquear a entrega do harness até existirem clipes (atrasa sem ganho).
- **Seções atualizadas em `spec.md`:** `Critérios mensuráveis de sucesso` (SC-001), `Decisões de clarificação resolvidas`, `Hipóteses e dependências`.

## Hipóteses remanescentes

- **Não crítica:** compatibilidade do Codex CLI com várias imagens por execução, disponibilidade do `gpt-6-luna` e configurabilidade do esforço de raciocínio — confirmadas empiricamente na primeira tarefa do adaptador (issue #7); se falharem, o plano é revisto e a API da OpenAI vira fallback.
- **Não crítica:** metas numéricas são exploratórias e revisáveis após a primeira rodada de benchmark com dados reais.

## Gate 1 — Clarificação aprovada

- **Status:** aprovado
- **Aprovador:** wezercarvalho
- **Data:** `2026-10-21`
- **Artefatos aprovados:** `spec.md`, `clarification.md`
- **Referência:** instrução explícita do maintainer na sessão de 2026-10-21 ("considere todos os gates aprovados" para as issues existentes); decisões registradas pelo orquestrador sob aprovação geral, revisáveis.
- **Observações:** metas numéricas são exploratórias de amostra pequena e revisáveis; residência de dados (`global` x `us`) e o adaptador Bedrock ficam fora da PoC, dependentes do acesso AWS (issue #2).
