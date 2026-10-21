# Seleção do modelo multimodal para o adivinhador (Fase 0)

**Tipo:** investigação técnica (sem implementação) · **Foco:** Amazon Bedrock para o MVP · **Verificado em:** 2026-10-20 · **Estado:** proposta para aprovação do maintainer

> **Aviso de evidência.** Este documento separa o que está **[DOCUMENTADO]** (página oficial, com URL e data de verificação), o que é **[ESTIMADO]** (cálculo nosso a partir de dados documentados, com premissas explícitas) e o que está **[NÃO VERIFICADO]** (precisa de teste empírico ou leitura de página no momento da implementação). **Não existe nenhuma medição de acurácia ou latência neste documento**: capacidade anunciada não é desempenho comprovado. As notas de 1 a 5 de reconhecimento visual e de latência são **provisórias** até o benchmark da seção 11. IDs de modelo e preços mudam com frequência (vários modelos citados foram lançados há semanas) e DEVEM ser relidos antes de codificar.

> **Atualização de escopo (2026-10-21).** Para a PoC, o primeiro provedor real passa a ser o **Codex CLI com `gpt-6-luna`**, usado só em desenvolvimento local e no benchmark, sem configurar AWS. O Bedrock (Haiku 5.5 e Nova 2 Lite) permanece como candidato de produção e segue válido nas seções abaixo, mas **não é mais pré-requisito da PoC**. O `gpt-6-luna` aceita texto e imagem, sem vídeo nativo, com esforço de raciocínio de `none` a `max` **[DOCUMENTADO, página do modelo na OpenAI, 2026-10-21]**; acurácia, latência, limites de imagens no Codex CLI, política de dados e termos de uso da assinatura continuam **[NÃO VERIFICADOS]**. A latência medida via CLI não representa a produção. Detalhes em [`specs/2026-10-20-vision-gesture-recognition-validate-waving-poc/spec.md`](../../specs/2026-10-20-vision-gesture-recognition-validate-waving-poc/spec.md).

## 1. Resumo executivo

- **Problema central:** 4 a 8 frames de webcam, ordenados, entram num modelo que devolve **um** palpite curto e estruturado. Isso é um problema de **múltiplas imagens**, não de vídeo: na janela de 2 a 3 s, o vídeo nativo com amostragem padrão de 1 FPS (Nova 2 e Gemini) entregaria só 2 a 3 frames, menos do que enviaríamos como imagens.
- **Recomendação para a PoC:** **Claude Haiku 5.5 no Amazon Bedrock** (Converse API, imagens, saída estruturada, raciocínio adaptativo **desligado**) como modelo principal, com **Amazon Nova 2 Lite** como desafiante no mesmo benchmark. A pontuação é **provisória**: a decisão final sai da comparação empírica, não desta tabela.
- **Custo não é o discriminador:** com as premissas da seção 5, uma tentativa custa de **US$ 0,0002 a US$ 0,0006** nos candidatos baratos (cerca de US$ 4 a US$ 13 para 10.000 sessões). A diferença entre eles é menor do que o erro de estimativa.
- **Riscos que mudam a decisão:** (1) **Nova 2 Lite** tem fim de vida (EOL) **não antes de 2026-12-02**; (2) **Claude Haiku 5.5** foi lançado em 2026-10-07, não tem camada Priority e vem com raciocínio adaptativo ligado por padrão; (3) frames de webcam saem para um provedor externo, com o perfil `global.` podendo processar em qualquer região.
- **Complemento barato, não substituto:** o MediaPipe no navegador (Apache-2.0) **não** tem "acenar" nativo, mas permite detectar o aceno pela oscilação do pulso. Fica para depois da PoC.
- **Decisões que dependem do maintainer** estão na seção 13.

## 2. Método e escopo

- Fontes primárias: páginas oficiais de modelo do Bedrock, guia de visão da Anthropic, listas de preços da AWS (Price List API pública, publicada em 2026-10-12 e 2026-10-16), documentação do Gemini e da OpenAI.
- Pesquisa feita em paralelo por provedor e consolidada aqui. Onde um relatório de apoio trouxe fórmula de fonte secundária e a página oficial a contradisse, **vale a oficial** (ex.: tokens de imagem do Claude, seção 5).
- Fora de escopo: treinamento, fine-tuning, implementação, infraestrutura além de um servidor mínimo.

## 3. Capacidade visual (o que cada modelo realmente aceita)

A distinção importa: **imagem única**, **múltiplas imagens** e **vídeo nativo** não são equivalentes.

| Candidato                        | Entrada                                                  | Vídeo nativo                                                                       | Imagens por requisição                                                                                                                                       | Tokens por imagem                                                                    |
| -------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| **Claude Haiku 5.5** (Bedrock)   | Imagem + texto                                           | **Não** (a página do modelo marca vídeo como não suportado)                        | 100 por requisição (modelos de 200k) ou 600 nos demais; acima de 20 imagens vale um limite de dimensão mais estrito; imagem de até 5 MB em base64 no Bedrock | **⌈L/28⌉ × ⌈A/28⌉** (patches de 28 px); ex.: 640×480 = 414 tokens                    |
| **Nova 2 Lite** (Bedrock)        | Imagem + vídeo + texto                                   | **Sim** (1 FPS, sem áudio; bytes até 25 MB ou S3 até 1 GB)                         | Até 5 embutidas na requisição ou até 1.000 via S3                                                                                                            | **230 tokens fixos** por imagem; redimensiona acima de 896 px                        |
| **Qwen3 VL 235B A22B** (Bedrock) | Imagem + texto (vídeo: **[NÃO VERIFICADO]** na Converse) | O fabricante destaca "video dynamics"; vale na Bedrock apenas após leitura do card | **[NÃO VERIFICADO]**                                                                                                                                         | **[NÃO VERIFICADO]**                                                                 |
| **Gemini 3.5 Flash-Lite**        | Imagem + vídeo + texto                                   | **Sim** (1 FPS padrão; fps e recorte configuráveis)                                | Até 3.600 (20 MB no total se embutidas)                                                                                                                      | **258 tokens** se ≤ 384 px; acima disso, tiles de 768 px a 258 tokens cada           |
| **GPT-6 Luna** (OpenAI)          | Imagem + texto                                           | **Não documentado** na API de visão (só múltiplas imagens)                         | Até 1.500, 512 MB por requisição                                                                                                                             | Patches de 32 px × multiplicador (1,2 para a família); `detail: low` cabe em 512×512 |
| **SmolVLM2** (open-source)       | Imagem + vídeo                                           | Sim                                                                                | Depende do runtime                                                                                                                                           | Depende do runtime                                                                   |

Fontes: [card do Claude Haiku 5.5](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-haiku-5-5.html), [card do Nova 2 Lite](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-amazon-nova-2-lite.html), [guia de visão do Claude](https://platform.claude.com/docs/en/build-with-claude/vision), [multimodal do Nova 2](https://docs.aws.amazon.com/nova/latest/nova2-userguide/using-multimodal-models.html), [imagens do Gemini](https://ai.google.dev/gemini-api/docs/image-understanding), [vídeo do Gemini](https://ai.google.dev/gemini-api/docs/video-understanding), [imagens e visão da OpenAI](https://developers.openai.com/api/docs/guides/images-vision), [SmolVLM2](https://huggingface.co/blog/smolvlm2). Verificado em 2026-10-20.

**Habilidades que ninguém documenta com números:** entender relação temporal entre frames, distinguir gestos parecidos (acenar x levantar a mão x coçar a cabeça), lidar com ângulos e iluminação e produzir um palpite sem rótulos pré-definidos. Todas são **[NÃO VERIFICADO]** e viram métricas do benchmark. O vídeo nativo **não** é automaticamente melhor: com 1 FPS, um clipe de 3 s vira 3 frames.

## 4. Desempenho

| Aspecto                                  | O que está documentado                                                                                                                                                                        | O que exige teste empírico                                              |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Latência / tempo até a primeira resposta | Só posicionamento qualitativo ("mais rápido", "baixa latência"). **Nenhum provedor publica milissegundos para este caso.**                                                                    | Mediana e p95 por modelo, com 4 x 6 x 8 frames e 512 x 768 px.          |
| Camadas de serviço (Bedrock)             | **Nova 2 Lite:** Standard, **Priority** e **Flex**. **Claude Haiku 5.5:** só **Standard**. Nova Lite v1: só Standard.                                                                         | Ganho real do Priority.                                                 |
| Prêmio do Priority                       | Na lista de preços, Nova 2.0 Lite e Pro cobram **1,75×** o preço Standard em Priority (ex.: entrada de US$ 0,525 contra US$ 0,30 por 1M tokens) **[ESTIMADO a partir da lista]**.             | Se compensa.                                                            |
| Streaming                                | `ConverseStream` existe; para um JSON de poucas dezenas de tokens traz pouco valor.                                                                                                           | Não necessário na PoC.                                                  |
| Raciocínio                               | **Haiku 5.5:** raciocínio adaptativo **ligado por padrão**, pode ser desligado; **desligue** para latência. **Nova 2 Lite:** desligado por padrão. **Gemini:** use `thinking_level: minimal`. | Efeito na acurácia e no custo de saída.                                 |
| Limites de taxa                          | Cotas padrão por conta e região (Bedrock), tiers Build/Launch/Grow (OpenAI: Luna 2M TPM no Build).                                                                                            | Cotas reais da conta do projeto no Service Quotas **[NÃO VERIFICADO]**. |
| Região                                   | Haiku 5.5 em `sa-east-1` só pelo perfil **global**; **Nova 2 Lite não aparece em `sa-east-1`**.                                                                                               | RTT do Brasil para `us-east-1` / `us-west-2`.                           |
| Tempo quase real                         | Não há promessa de tempo real: a PoC trabalha por janelas de captura e respostas assíncronas, como no `PROJECT_SPEC.md`.                                                                      | Percepção de espera do jogador.                                         |

## 5. Custo

### 5.1 Premissas (explícitas)

- **Frames por tentativa:** 6, em 640×480 JPEG, capturados a cada ~400 ms (janela de ~2,4 s).
- **Texto do prompt:** ~250 tokens. **Saída:** ~40 tokens (JSON curto). Raciocínio desligado.
- **Tentativas por rodada:** 2 em média (um erro seguido de uma nova tentativa). **Sessão** = 1 rodada = 2 tentativas.
- **Árbitro semântico:** determinístico na maior parte; o LLM de ambiguidade é texto curto e custa menos de US$ 0,00005 por chamada. **Excluído** da conta.
- **Preços documentados:** lista pública da AWS (us-east-1, sob demanda, camada Standard, perfil **global**, que é o mais barato; o perfil regional custa ~10% a mais) e páginas oficiais do Gemini e da OpenAI. Tokens por imagem: ver seção 3. Para o Qwen3 VL e o Nova Lite v1, o tamanho do token por imagem é **[NÃO VERIFICADO]** e foi estimado (414 e 500).

### 5.2 Resultado

| Modelo                         | US$/1M entrada / saída | Tokens de entrada | Custo por tentativa | 1 sessão (2 tent.) | 100 sessões  | 1.000 sessões | 10.000 sessões |
| ------------------------------ | ---------------------- | ----------------- | ------------------- | ------------------ | ------------ | ------------- | -------------- |
| GPT-6 Luna                     | 0,10 / 0,50            | 1.636             | US$ 0,00018         | US$ 0,00037        | US$ 0,04     | US$ 0,37      | US$ 3,67       |
| **Claude Haiku 5.5** (Bedrock) | 0,10 / 0,50            | 2.734             | **US$ 0,00029**     | **US$ 0,00059**    | **US$ 0,06** | **US$ 0,59**  | **US$ 5,87**   |
| Nova Lite v1 (Bedrock) \*      | 0,06 / 0,24            | ~3.250 \*         | US$ 0,00021         | US$ 0,00041        | US$ 0,04     | US$ 0,41      | US$ 4,09       |
| **Nova 2 Lite** (Bedrock)      | 0,30 / 2,50            | 1.630             | **US$ 0,00059**     | **US$ 0,00118**    | **US$ 0,12** | **US$ 1,18**  | **US$ 11,78**  |
| Gemini 3.5 Flash-Lite          | 0,30 / 2,50            | 1.798             | US$ 0,00064         | US$ 0,00128        | US$ 0,13     | US$ 1,28      | US$ 12,79      |
| Qwen3 VL 235B (Bedrock) \*     | 0,53 / 2,66            | ~2.734 \*         | US$ 0,00156         | US$ 0,00311        | US$ 0,31     | US$ 3,11      | US$ 31,11      |
| Nova 2 Pro (Bedrock)           | 1,25 / 10,00           | 1.630             | US$ 0,00244         | US$ 0,00487        | US$ 0,49     | US$ 4,88      | US$ 48,75      |
| Claude Sonnet 4.6 (Bedrock)    | 3,00 / 15,00           | 2.734             | US$ 0,00880         | US$ 0,01760        | US$ 1,76     | US$ 17,60     | US$ 176,04     |

\* tokens por imagem estimados. Todas as linhas são **[ESTIMADO]** com preço **[DOCUMENTADO]**: a lista de preços da AWS é de 2026-10-12/16; os demais preços vêm das páginas oficiais em 2026-10-20 (Luna: [preços da OpenAI](https://developers.openai.com/api/docs/pricing); Gemini: [preços do Gemini](https://ai.google.dev/gemini-api/docs/pricing)). O Claude Haiku 5.5 é cobrado via **AWS Marketplace** (a cobrança aparece sob o provedor do modelo, não sob "Bedrock") e prompts acima de 100k tokens têm tarifa maior, irrelevante aqui.

### 5.3 Sensibilidade: reduzir resolução ou frames reduz custo?

- **Frames:** o custo de entrada cai quase linearmente. Haiku 5.5: 4 frames a 512×384 = US$ 0,15 por 1.000 tentativas; 6 a 640×480 = US$ 0,29; 8 a 768×576 = US$ 0,52.
- **Resolução:** só reduz custo nos modelos que cobram **por patch** (Claude: 6 frames a 320×240 caem para US$ 0,11 por 1.000 tentativas). Em **Nova 2 Lite** (230 fixos) e **Gemini** (258 fixos abaixo de 384 px) a resolução não muda o custo, mas ainda afeta rede e latência.
- **Conclusão:** em escala de PoC o custo é desprezível. Reduzir frames e resolução vale por **latência e transmissão de dados** (privacidade), não por economia.

## 6. Experiência do desenvolvedor (React + Vite + TypeScript + Node.js)

| Critério          | Bedrock (Claude Haiku 5.5 / Nova 2 Lite)                                                                                                     | Gemini                                                                    | OpenAI                                                   |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------- |
| SDK TypeScript    | `@aws-sdk/client-bedrock-runtime` (v3), `ConverseCommand`; imagem como bytes. **[DOCUMENTADO]**                                              | `@google/genai` (API de Interações mais recente; muda a forma do código). | Pacote `openai`; imagem como data URL base64.            |
| Saída estruturada | **Haiku 5.5:** recurso "Structured outputs" suportado. **Nova 2 Lite / Nova Lite:** não listado; usar **tool use** com `toolChoice` forçado. | JSON schema (Zod).                                                        | Structured Outputs (formato exato **[NÃO VERIFICADO]**). |
| Autenticação      | **IAM** (role, cadeia padrão do SDK) ou **chave de API do Bedrock** (`AWS_BEARER_TOKEN_BEDROCK`); IAM é preferível em produção.              | Chave de API.                                                             | Chave de API.                                            |
| Troca de modelo   | No Bedrock, trocar `modelId` entre Claude e Nova **na mesma Converse API**; os formatos de saída estruturada diferem (recurso x tool use).   | Outro SDK.                                                                | Outro SDK.                                               |
| Estabilidade      | Haiku 5.5: ativo, EOL **não antes de 2027-10-07**. Nova 2 Lite: EOL **não antes de 2026-12-02**, com período legado mínimo de 6 meses.       | Linhagem muda rápido.                                                     | Linhagem muda rápido.                                    |
| Acesso ao modelo  | Acesso a todos os modelos "habilitado por padrão"; para Anthropic, o primeiro uso pode exigir **detalhes de caso de uso**.                   | Chave.                                                                    | Chave.                                                   |
| Lock-in           | Baixo se o código usar a interface `GuesserProvider` (seção 9).                                                                              | —                                                                         | —                                                        |

Fontes: cards de modelo e [chaves de API do Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-haiku-5-5.html) (seção "Sample Code"), [Converse](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_Converse.html), documentação do Gemini e da OpenAI listadas em 15.

## 7. Privacidade e segurança

Os provedores **não** oferecem as mesmas garantias; nenhuma deve ser presumida.

| Tema                     | Bedrock                                                                                                                                                                                                                     | Gemini                                                                                                                                                  | OpenAI                                                                            |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Uso para treinar modelos | **[DOCUMENTADO]** Os provedores de modelo **não têm acesso** a prompts, respostas nem logs do Bedrock (contas de implantação por provedor).                                                                                 | **[DOCUMENTADO]** Camada **gratuita**: entradas **são** usadas para melhorar produtos. Camada **paga**: **não** são. Use a paga para imagens de webcam. | **[NÃO VERIFICADO]** (página "Your data" não lida).                               |
| Retenção                 | Prazos e opções de retenção **[NÃO VERIFICADOS neste ciclo]**; ler [retenção de dados](https://docs.aws.amazon.com/bedrock/latest/userguide/data-retention.html) e a política do provedor do modelo antes da implementação. | Duração da retenção paga **[NÃO VERIFICADO]**.                                                                                                          | **[NÃO VERIFICADO]**.                                                             |
| Região de processamento  | `global.` roteia para **qualquer região**; `us.` / `eu.` mantêm dentro da geografia. Haiku 5.5 em `sa-east-1`: só global.                                                                                                   | **[NÃO VERIFICADO]**                                                                                                                                    | Residência regional existe com +10% (Brasil/América do Sul **[NÃO VERIFICADO]**). |
| Credenciais              | IAM role (sem chave estática) preferível.                                                                                                                                                                                   | Chave só no servidor.                                                                                                                                   | Chave só no servidor.                                                             |

**Medidas independentes de provedor:** frames transitórios e nunca persistidos; menos frames e menor resolução; aviso claro ao jogador de que os frames vão a um provedor externo; credencial só no servidor; limite de payload, rate limit e teto de custo na rota. Ver [privacidade e segredos](../development-context/security/privacy-and-secrets.md).

**Decisão de privacidade a tomar:** o perfil `global.` é o mais barato e o único disponível para o Haiku 5.5 em São Paulo, mas processa em qualquer região. Para restringir à geografia dos EUA, use `us.` a partir de `us-east-1` (preço ~10% maior). Registrar a escolha na spec.

## 8. Pontuação ponderada (provisória)

Pesos: visão 35%, latência 25%, custo 20%, integração 10%, escala e manutenção 10%. Nota 1 a 5. **As notas de visão e latência são provisórias** (sem medição); as de custo, integração e manutenção têm base documentada.

| Candidato                      | Visão (35%) | Latência (25%) | Custo (20%) | Integração (10%) | Escala/manut. (10%) | **Total** |
| ------------------------------ | ----------- | -------------- | ----------- | ---------------- | ------------------- | --------- |
| **Claude Haiku 5.5** (Bedrock) | 4 prov.     | 3 prov.        | 5           | 5                | 4                   | **4,05**  |
| Gemini 3.5 Flash-Lite          | 4 prov.     | 4 prov.        | 4           | 4                | 3                   | **3,90**  |
| GPT-6 Luna                     | 3 prov.     | 4 prov.        | 5           | 4                | 4                   | **3,85**  |
| **Nova 2 Lite** (Bedrock)      | 3 prov.     | 4 prov.        | 4           | 4                | 3                   | **3,55**  |
| Qwen3 VL 235B (Bedrock)        | 4 prov.     | 2 prov.        | 3           | 3 prov.          | 3                   | **3,10**  |
| SmolVLM2 (no navegador)        | 2 prov.     | 3 prov.        | 5           | 2                | 2                   | **2,85**  |

**Evidência por nota**

- **Visão (provisória em todos):** não há benchmark de ações. Haiku 5.5 recebe 4 por ser a geração mais recente da família Claude, com camada de alta resolução e imagens como entrada nativa; Gemini 3.5 Flash-Lite recebe 4 pelo foco documentado da família em vídeo; Nova 2 Lite e Luna recebem 3 por serem camadas econômicas de propósito geral; Qwen3 VL recebe 4 pelo destaque do fabricante em dinâmica de vídeo, sem confirmação na Bedrock; SmolVLM2 recebe 2 pelo tamanho.
- **Latência (provisória):** Nova 2 Lite e Gemini/Luna têm opções de baixa latência documentadas (Priority/Fast, raciocínio mínimo); Haiku 5.5 só tem Standard e começa com raciocínio ligado (nota 3, subindo para 4 se o benchmark mostrar latência adequada com raciocínio desligado); Qwen3 VL 235B é um modelo grande (nota 2).
- **Custo:** ver seção 5. A diferença entre 5 e 4 é de poucos décimos de centavo por 1.000 sessões.
- **Integração:** Haiku 5.5 e Nova 2 Lite usam a mesma Converse API com IAM; Haiku 5.5 tem saída estruturada nativa; Nova exige tool use. Gemini e OpenAI adicionam um segundo SDK e segredo.
- **Escala e manutenção:** Haiku 5.5 tem EOL mínimo de um ano; Nova 2 Lite tem EOL mínimo em 2026-12-02; cotas de todos são **[NÃO VERIFICADO]** para a conta do projeto.

## 9. Rankings e arquitetura

### 9.1 Ranking (B)

1. **Melhor opção geral (provisória): Claude Haiku 5.5 no Bedrock.** Maior nota ponderada, saída estruturada nativa, mesma API e IAM da alternativa Nova, EOL mínimo de 1 ano e custo no patamar do mais barato. Fraquezas: sem Priority, raciocínio ligado por padrão, lançamento recente (maturidade e cotas não verificadas).
2. **Melhor custo-benefício:** na Bedrock, o **Haiku 5.5** (US$ 0,29 por 1.000 tentativas); no geral, o **GPT-6 Luna** (US$ 0,18). A diferença é irrelevante na escala da PoC e **não deve decidir**.
3. **Melhor para baixa latência (provisória):** **Nova 2 Lite com Priority** (camada documentada, ~1,75× o preço), seguido pelos "Flash-Lite" e "Luna" fora do Bedrock. Antes dos modelos, o maior ganho de latência vem de menos frames, menor resolução e raciocínio desligado.
4. **Open-source / auto-hospedado:** **SmolVLM2** (Apache-2.0, vídeo e múltiplas imagens, executável no navegador via transformers.js e WebGPU) é o único viável para eliminar a API, mas a qualidade é desconhecida; é exploração futura, não MVP. **Qwen3-VL** tem melhor qualidade esperada e rota hospedada no Bedrock, mas é pesado e mais lento.

### 9.2 Opções de arquitetura (A a D)

| Opção                                                                       | Complexidade                                             | Desempenho                                                                    | Custo         | Escala | Veredito                                |
| --------------------------------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------- | ------ | --------------------------------------- |
| **A. Múltiplas imagens (frames amostrados)**                                | Baixa                                                    | Controlável (frames, resolução)                                               | Previsível    | Alta   | **Recomendada para a PoC**              |
| B. Vídeo nativo (Nova 2 Lite, Gemini)                                       | Média (codificar clipe no navegador, limites de tamanho) | 1 FPS padrão não traz mais informação temporal; **o Haiku 5.5 não tem vídeo** | Similar       | Média  | Testar como variante, depois            |
| C. MediaPipe + LLM                                                          | Média (pipeline cliente, heurística)                     | Aceno por oscilação do pulso: zero custo, sem rede; **não generaliza**        | Menor         | Alta   | Otimização futura para ações conhecidas |
| D. Modelo especializado (VideoMAE / X-CLIP, Kinetics-700 tem "waving hand") | Alta (servidor, GPU, ONNX para o navegador)              | Boa para rótulos fixos; Kinetics-400 **não** tem o rótulo                     | Infra própria | Média  | Fora do MVP                             |

A escolha **A** cumpre "sem treinamento", "sem infraestrutura antecipada" e "provedor intercambiável".

### 9.3 Arquitetura mínima recomendada (C)

```text
Navegador (React/Vite/TS)            Servidor mínimo (Node/TS)              Bedrock
  captura 6 frames JPEG  ──HTTPS──▶  valida payload (limites, timeout)  ──▶  Converse API
  (sob comando, efêmeros)            GuesserProvider (interface)             (Claude / Nova)
  mostra palpite/erro   ◀──────────  schema + erros estáveis, métricas  ◀──  IAM role / chave
```

- Contrato `GuesserProvider` conforme o [guia de arquitetura](../development-context/architecture/architecture-guide.md): `BedrockClaudeProvider`, `BedrockNovaProvider`, `MockGuesserProvider`. Trocar de modelo muda configuração (`modelId`, região, flags), não UI nem captura.
- O prompt é **genérico** e não contém a palavra-alvo nem sinônimos.
- Trecho de referência (a validar na implementação: ID do perfil, suporte a `toolChoice` no modelo escolhido e à opção `performanceConfig`):

```ts
import {
    BedrockRuntimeClient,
    ConverseCommand,
} from '@aws-sdk/client-bedrock-runtime'

const client = new BedrockRuntimeClient({ region: 'us-east-1' })

// frames: Buffer[] com JPEGs em ordem temporal
const imageBlocks = frames.map((bytes) => ({
    image: { format: 'jpeg' as const, source: { bytes } },
}))

const res = await client.send(
    new ConverseCommand({
        modelId: process.env.GUESSER_MODEL_ID!, // ex.: global.anthropic.claude-haiku-5-5
        messages: [
            {
                role: 'user',
                content: [
                    ...imageBlocks,
                    {
                        text: 'These are consecutive webcam frames, in chronological order. Call guess_action.',
                    },
                ],
            },
        ],
        toolConfig: {
            tools: [
                {
                    toolSpec: {
                        name: 'guess_action',
                        description:
                            'Return the predominant human action observed, in a few words.',
                        inputSchema: {
                            json: {
                                type: 'object',
                                properties: {
                                    action: { type: 'string' },
                                    insufficient_evidence: { type: 'boolean' },
                                },
                                required: ['action', 'insufficient_evidence'],
                            },
                        },
                    },
                },
            ],
            toolChoice: { tool: { name: 'guess_action' } },
        },
        inferenceConfig: { maxTokens: 64, temperature: 0.2 },
    }),
)
// Resultado em res.output?.message?.content[].toolUse?.input
```

## 10. Árbitro semântico

- **Começar sem LLM:** normalização (minúsculas, acentos, pontuação) e comparação por **equivalência de expressão** com resposta canônica e aliases; palpites genéricos conhecidos (`levantar a mão`) são rejeitados. Isso cobre a carta única do MVP e é testável e gratuito.
- **LLM só para ambiguidade e depois:** um modelo pequeno de **texto** (Haiku 5.5 ou Nova Lite) com resposta estruturada `{isCorrect, method}`. Em dúvida, retornar `undetermined` e deixar a UX pedir nova tentativa.
- **Responsabilidades separadas:** o árbitro nunca vê a webcam, e a acurácia visual é medida **sem** o árbitro de LLM (no benchmark, usar a lista determinística de aliases) para não misturar visão e semântica.

## 11. Plano de benchmark (D)

Objetivo: decidir entre os candidatos com evidência reproduzível, **sem inferir uma taxa geral de acerto**.

**Cenários (carta "Acenar")**

| Tipo      | Cenários                                                                                                                                     |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Positivos | P1 aceno com a mão direita; P2 com a esquerda; P3 aceno lento; P4 aceno rápido; P5 aceno de perfil parcial; P6 fundo e iluminação diferentes |
| Negativos | N1 parado; N2 mão levantada sem acenar; N3 coçando a cabeça; N4 movendo os dois braços aleatoriamente; N5 sem pessoa no quadro               |

**Amostragem e execução**

- Janela de **2,4 s**, **6 frames** a cada ~400 ms, 640×480 JPEG (variantes: 4 e 8 frames; 512×384 e 768×576).
- **Clipes gravados uma vez e reproduzidos offline** contra todos os modelos (mesma entrada para todos), com consentimento de quem aparece. Esse conjunto fica **local e fora do Git**, é apagável e é a única exceção à regra de não persistir frames, restrita ao benchmark.
- Tamanho mínimo sugerido: **10 clipes por cenário** (≈ 110 clipes), 2 a 3 pessoas, 2 ambientes. Cada modelo roda cada clipe 1 vez a `temperature` baixa; repetir 3 vezes uma amostra para medir variabilidade.

**Prompt (genérico) e saída esperada**

- Mensagem de sistema: descreve a mecânica de forma genérica ("você observa frames consecutivos de uma webcam e diz qual a ação humana predominante").
- Pedido: "Estes são N frames em ordem cronológica, espaçados de ~400 ms. Descreva a ação predominante em poucas palavras ou indique evidência insuficiente."
- **Não** incluir "acenar", sinônimos, dica ou sugestão; **não** pedir `confidence` (autodeclarada, não calibrada).

```json
{ "action": "waving hand", "insufficient_evidence": false }
```

**Métricas**

- Acurácia, **precisão**, **recall**, falsos positivos (negativo respondido como aceno), falsos negativos, "evidência insuficiente" em positivos, erros técnicos.
- Latência **mediana e p95** de ponta a ponta (do envio ao palpite), a partir do servidor.
- **Custo por tentativa e por acerto** (tokens reais devolvidos pela API).
- Um palpite conta como "aceno" se casar, por regra determinística, com a lista de aliases; `levantar a mão` não conta.

**Limitações (declarar no relatório)**

- Uma única ação e ~110 clipes: com 40 positivos, um recall observado de 90% tem intervalo de confiança de 95% (Wilson) de cerca de **77% a 96%**; com 95%, de **83% a 99%**. Diferenças pequenas entre modelos **não são estatisticamente distinguíveis**.
- Poucas pessoas e ambientes limitam a generalização para outros ângulos, tons de pele, câmeras e iluminação.
- "Acenar" é um dos gestos mais fáceis; bom desempenho **não** prova que o modelo serve para outras cartas.
- A latência medida depende da rede, da região e da carga do momento; repetir em horários diferentes.
- Não comparar contra modelos treinados nem concluir sobre acurácia geral do jogo.

**Ordem de execução:** (1) Haiku 5.5 e Nova 2 Lite, raciocínio desligado, 6 frames; (2) variantes 4 e 8 frames e resoluções; (3) Nova 2 Lite em vídeo nativo; (4) apenas se nenhum satisfizer as metas, controles fora do Bedrock (Gemini 3.5 Flash-Lite e GPT-6 Luna). **Metas numéricas mínimas** (acerto, falso positivo, latência) estão em aberto no `PROJECT_SPEC.md` e precisam ser definidas na clarificação da spec antes do benchmark.

## 12. Proposta de decisão final (E)

- **Modelo para a PoC:** **Claude Haiku 5.5 no Bedrock** (`global.anthropic.claude-haiku-5-5`, ou `us.` se a decisão de residência exigir), raciocínio adaptativo desligado, saída estruturada, 6 frames a 640×480. **Desafiante** no mesmo benchmark: **Nova 2 Lite** (`global.amazon.nova-2-lite-v1:0`).
- **Por que:** maior nota ponderada, mesma API e IAM do desafiante, saída estruturada nativa, EOL mínimo de um ano e custo desprezível. A decisão é **provisória** até o benchmark.
- **Custo operacional estimado (PoC):** de **US$ 0,06 a US$ 0,12** a cada 100 sessões e **US$ 0,6 a US$ 1,2** a cada 1.000 (Haiku 5.5 e Nova 2 Lite, global, Standard). Um benchmark de ~110 clipes x 8 configurações x 2 modelos custa **menos de US$ 2** **[ESTIMADO]** (≈ 1.760 chamadas a US$ 0,0003 a 0,0006).
- **Limitações esperadas:** sem vídeo nativo no Haiku 5.5; latência sem medição; sem Priority; acurácia temporal desconhecida; aceno de perfil ou com mão pequena no quadro pode falhar.
- **Riscos técnicos:** (1) raciocínio ligado por padrão no Haiku 5.5 aumenta latência e custo de saída se não for desligado; (2) EOL do Nova 2 Lite a partir de 2026-12-02; (3) cobrança do Haiku via Marketplace e possível formulário de caso de uso da Anthropic no primeiro acesso; (4) cotas padrão e acesso ao modelo na conta **[NÃO VERIFICADO]**; (5) `global.` processa fora do país; (6) modelos e preços recentes podem mudar.
- **Quando trocar de provedor ou arquitetura:**
    - recall abaixo da meta ou falsos positivos acima da meta nos dois modelos Bedrock → testar os controles Gemini e Luna e, depois, vídeo nativo;
    - latência mediana ou p95 acima da meta mesmo com raciocínio desligado e menos frames → Nova 2 Lite com Priority, depois pré-filtro MediaPipe (opção C);
    - exigência de residência de dados que o Bedrock não atenda para o modelo escolhido → outro provedor/região;
    - custos subirem por ordem de grandeza (muitas tentativas por rodada) → reavaliar frames e resolução antes de trocar de modelo.

## 13. Decisões e pendências para o maintainer

1. Aprovar (ou ajustar) o par **Haiku 5.5 x Nova 2 Lite** para o benchmark e a regra de decisão acima.
2. Definir metas numéricas mínimas de acerto, falso positivo e latência.
3. Definir residência: perfil `global.` (mais barato, processa em qualquer região) ou `us.`.
4. Confirmar que existe conta AWS com acesso ao Bedrock e permissão para o primeiro uso de modelos Anthropic (e Marketplace); IAM role ou chave de API do Bedrock.
5. Aprovar a coleta de clipes do benchmark com consentimento e armazenamento local fora do Git.

## 14. Lacunas não verificadas

- Acurácia visual e latência real de **todos** os modelos (somente o benchmark responde).
- Cotas padrão (RPM/TPM) do Bedrock na conta do projeto; formato exato da cobrança do Haiku 5.5 no Marketplace; parâmetros de `performanceConfig` por modelo.
- Suporte e limites de vídeo e imagem do Qwen3 VL, Nova 2 Omni e Nova 2 Pro na Converse (estes dois aparecem na lista de preços, mas não no catálogo público).
- OpenAI: política de dados e retenção, formato exato de Structured Outputs e custo oficial de imagem. Gemini: limites de taxa do `gemini-3.5-flash-lite`, retenção da camada paga e nível intermediário de `media_resolution`. Anthropic direto: política de retenção.
- Fórmula de tokens de imagem para Nova Lite v1 e Qwen3 VL.
- Correção de uma fonte secundária: um dos relatórios citava `largura × altura / 750` e "5 imagens por requisição" para o Claude; a documentação oficial atual usa patches de 28 px e limites de 100 ou 600 imagens. **Prevalece a oficial.**

## 15. Fontes (verificadas em 2026-10-20)

- Bedrock: [Claude Haiku 5.5](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-haiku-5-5.html), [Nova 2 Lite](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-amazon-nova-2-lite.html), [Nova Lite](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-amazon-nova-lite.html), [imagem e vídeo no Nova 2](https://docs.aws.amazon.com/nova/latest/nova2-userguide/using-multimodal-models.html), [lançamento do Nova 2](https://aws.amazon.com/about-aws/whats-new/2025/12/nova-2-foundation-models-amazon-bedrock/), [proteção de dados](https://docs.aws.amazon.com/bedrock/latest/userguide/data-protection.html), [retenção](https://docs.aws.amazon.com/bedrock/latest/userguide/data-retention.html), [Converse API](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_Converse.html), [cotas](https://docs.aws.amazon.com/bedrock/latest/userguide/quotas.html).
- Preços AWS: [Price List do AmazonBedrockFoundationModels](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonBedrockFoundationModels/current/index.json) e [do AmazonBedrock](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonBedrock/current/index.json) (publicados em 2026-10-12 e 2026-10-16); [página de preços do Bedrock](https://aws.amazon.com/bedrock/pricing/).
- Claude: [guia de visão](https://platform.claude.com/docs/en/build-with-claude/vision).
- Gemini: [modelos](https://ai.google.dev/gemini-api/docs/models), [preços](https://ai.google.dev/gemini-api/docs/pricing), [imagens](https://ai.google.dev/gemini-api/docs/image-understanding), [vídeo](https://ai.google.dev/gemini-api/docs/video-understanding), [saída estruturada](https://ai.google.dev/gemini-api/docs/structured-output), [políticas de uso](https://ai.google.dev/gemini-api/docs/usage-policies).
- OpenAI: [modelos](https://developers.openai.com/api/docs/models), [preços](https://developers.openai.com/api/docs/pricing), [imagens e visão](https://developers.openai.com/api/docs/guides/images-vision), [limites de taxa](https://developers.openai.com/api/docs/guides/rate-limits).
- Alternativas: [Gesture Recognizer (MediaPipe)](https://developers.google.com/edge/mediapipe/solutions/vision/gesture_recognizer), [opções do Gesture Recognizer na web](https://developers.google.com/edge/api/mediapipe/js/tasks-vision.gesturerecognizeroptions), [SmolVLM2](https://huggingface.co/blog/smolvlm2), [VideoMAE](https://huggingface.co/docs/transformers/model_doc/videomae), [TimeSformer](https://huggingface.co/docs/transformers/en/model_doc/timesformer).
