# Prompt de desenvolvimento — Guess My Move

> **Uso:** copie o conteúdo abaixo para o agente de programação conectado ao repositório `guess-my-move`, anexando ou disponibilizando também `PROJECT_SPEC.md`. Este prompt serve para iniciar a **Fase 0 (PoC visual)** e preparar os limites da Fase 1, **sem implementar antecipadamente todas as evoluções**.

---

Você é um engenheiro de software sênior, especializado em aplicações web, TypeScript, integração com modelos multimodais e arquitetura pragmática. Sua missão é iniciar o repositório open-source **Guess My Move** (`guess-my-move`).

## 1. Contexto do produto

Guess My Move é um jogo de mímica no qual o **humano atua diante da webcam** e uma **IA multimodal tenta adivinhar a ação**. O jogador recebe uma carta secreta (para a IA). Um motor do jogo controla a rodada e um árbitro semântico, em fase posterior, valida automaticamente o palpite.

Carta inicial (única):

- **Palavra:** Acenar.
- **Dica:** Um gesto usado para cumprimentar ou se despedir de alguém à distância.
- **Sugestão:** Levante uma das mãos e movimente-a de um lado para o outro.
- **Resposta canônica:** `acenar`.
- **Aliases válidos para julgamento futuro:** `dar tchau`, `acenando`, `waving`, `waving goodbye`.
- **Exemplos de palpites insuficientes:** `levantar a mão`, `mexer os braços`.

A IA adivinhadora **jamais deve receber a resposta da carta, dica, sugestão ou aliases**. Seu input é exclusivamente a sequência temporal de imagens e instruções **genéricas** sobre o jogo. O usuário **não será o árbitro do acerto**.

Leia `PROJECT_SPEC.md` como fonte de contexto e de decisões de produto; sinalize divergências entre este prompt e a implementação existente em vez de assumir que tudo já está definido.

## 2. Objetivo EXCLUSIVO deste primeiro incremento

Entregar uma **prova de conceito executável localmente** que:

1. Exiba uma interface mínima no navegador.
2. Solicite permissão de câmera e mostre preview local.
3. Capture uma **sequência curta de frames**, preservando sua ordem temporal, após comando explícito do jogador.
4. Envie frames por meio de uma **API server-side** que mantém o segredo do provedor fora do browser.
5. Use um modelo multimodal **pré-treinado** para gerar **um palpite curto** sobre o movimento do jogador.
6. Apresente o palpite na interface e diferencie claramente os estados `capturing`, `processing`, `success`, `error`.
7. Permita repetir o experimento e parar a câmera.
8. Registre métricas técnicas mínimas não sensíveis (tempo de execução, erro/sucesso, quantidade de frames).
9. Tenha um **modo mock** que funcione sem API key, para testes e contribuições externas.

**Não implementar nesta etapa:** banco de dados, autenticação, multiplayer, pontuação, cronômetro competitivo, baralho ampliado, árbitro visual, treinamento/fine-tuning, MediaPipe, reconhecimento contínuo, ranking, transcrição de áudio ou animações geradas por IA. **Não simular como validada a precisão visual**: isso depende de testes reais.

## 3. Stack e princípios

- **Preferência de frontend:** React + Vite + TypeScript.
- **Backend mínimo:** Node.js/TypeScript (servidor pequeno ou função equivalente) para a integração segura com o provedor. Usar NestJS apenas se houver justificativa concreta; evitar complexidade desnecessária na PoC.
- **Sem banco de dados** no incremento inicial.
- **Interface do provedor:** permitir trocar modelo sem reescrever UI/captura.
- **Qualidade:** código legível, tipos explícitos, modularidade suficiente, validação de entrada e testes nos pontos críticos.
- **Documentação:** README com requisitos, instalação, modo mock, modo real, configuração, privacidade, limites conhecidos e passos de teste.
- **Segurança:** jamais incluir chaves no frontend, em logs ou no repositório. Gerar `.env.example` com placeholders.
- **Privacidade:** frames transitórios, sem upload em background ou persistência por padrão; comunicar ao usuário quando frames forem enviados à API/provedor.
- **Escopo enxuto:** não criar uma arquitetura de microsserviços, filas ou abstrações antes da necessidade.

Se houver decisão técnica não definida — especialmente **provedor/modelo e credenciais** — projete uma interface configurável e uma implementação mock. Não invente preços, suporte nativo a vídeo, limites de contexto ou disponibilidade do modelo. Se for necessário escolher um provedor real, documente a decisão com evidências atuais ou deixe a opção explícita para configuração posterior.

## 4. Design de interação esperado

A página deve comunicar claramente: **Guess My Move — Act it. Let AI guess.**

Estrutura mínima:

- Cabeçalho com nome do projeto e breve descrição.
- Card **Acenar**, com dica e sugestão, visível ao jogador. Esses campos **nunca entram no payload do adivinhador**.
- Bloco de webcam com indicação de permissão e status.
- Ações claras: **Ativar câmera**, **Capturar mímica / Adivinhar**, **Tentar novamente**, **Parar câmera**.
- Bloco de resultado com **palpite da IA**, duração e mensagens de falha recuperável.

Não prometer vídeo em tempo real: esta etapa usa **amostragem de frames sob demanda**.

## 5. Contratos desejados

Defina contratos simples e tipados, similares aos exemplos abaixo, adaptando-os ao projeto:

```ts
type CapturedFrame = {
    timestampMs: number
    mimeType: string
    data: string
}

type GuesserInput = {
    frames: CapturedFrame[]
    rejectedGuesses?: string[]
}

type GuesserResult = { guess: string }

interface GuesserProvider {
    guess(input: GuesserInput): Promise<GuesserResult>
}
```

O servidor deve validar payloads, impor limites conservadores de frames/tamanho, controlar timeout e converter falhas do provedor em respostas de erro estáveis. Não retornar detalhes internos nem credenciais.

O prompt da IA adivinhadora deve pedir **uma hipótese curta sobre a ação predominante observada nos frames em ordem cronológica** e, de preferência, uma saída estruturada. Não incluir a palavra “Acenar” nem qualquer sinônimo-alvo na instrução; isso contaminaria a avaliação. O modelo deve poder responder que **não há evidência suficiente** em vez de inventar ação.

## 6. Sequência de trabalho

### Etapa A — Planejamento leve

1. Inspecione o repositório antes de criar arquivos.
2. Resuma a estrutura proposta e dependências principais.
3. Identifique decisões que ainda dependem de credenciais ou escolha de provedor.
4. Proponha uma sequência incremental, sem gerar grandes scaffolds desnecessários.

### Etapa B — Implementação da PoC

1. Configure projeto web e servidor mínimo.
2. Implemente permissão, preview e parada da webcam.
3. Capture uma janela de frames com timestamps, limites e descarte após uso.
4. Implemente `MockGuesserProvider` com respostas controladas.
5. Implemente adaptador para provedor real, configurável por ambiente, **somente com base em API comprovadamente disponível**.
6. Conecte a interface à API e trate estados de requisição/erro.
7. Garanta em testes/inspeção que os dados públicos da carta não entram na chamada ao modelo.
8. Crie testes automatizados onde for útil e rode lint/typecheck/build.
9. Documente instalação e testes locais.

### Etapa C — Validação empírica

Prepare um checklist manual com: aceno claro, pessoa parada, mão levantada sem acenar, movimentos aleatórios, webcam negada e provedor indisponível. Registre os resultados esperados e observados, sem inventar medições. Sugira ajustes em quantidade/resolução/janela de frames com base no que foi efetivamente testado.

## 7. Critérios de aceite da PoC (BDD)

**Dado** que o usuário autorizou a webcam, **quando** aciona a captura, **então** o sistema coleta frames em ordem temporal e tenta obter um palpite textual.

**Dado** que a webcam foi negada, **quando** tenta iniciar, **então** nenhuma requisição de IA é feita e há uma mensagem útil ao jogador.

**Dado** que a carta “Acenar” está visível na tela, **quando** o adivinhador é chamado, **então** seu payload não contém palavra, dica, sugestão, resposta canônica ou aliases.

**Dado** que não há credencial de modelo, **quando** o app é executado em modo mock, **então** a interface continua testável sem custos de inferência.

**Dado** um erro/time-out do provedor, **quando** a tentativa termina, **então** a interface entra em estado recuperável, sem palpite inventado e sem travar a webcam.

## 8. Preparação para Fase 1, SEM implementar agora

Mantenha o desenho compatível com um futuro árbitro semântico que receberá `canonicalAnswer`, `acceptedAliases`, `insufficientGuesses` e `guess`; verificará respostas canônicas/aliases determinísticos antes de LLM opcional; e devolverá `{isCorrect, method}`. O árbitro **não verá a webcam**. A futura verificação visual da execução é um terceiro problema, independente do julgamento semântico.

Mantenha também espaço para uma máquina de estados de rodada e histórico de palpites rejeitados, mas **não implemente essas funcionalidades na PoC, exceto se forem indispensáveis**.

## 9. Entrega esperada do agente

Ao finalizar, apresente objetivamente:

1. **Arquivos criados/alterados** e papel de cada módulo.
2. **Comandos exatos** para instalar, configurar e executar (mock e modo real, se disponível).
3. **Testes executados e resultados verificados**, sem alegar sucesso de testes não rodados.
4. **Limitações conhecidas**, principalmente latência, comportamento com movimento e dependência de provedor.
5. **Próximas 3–5 tarefas**, priorizadas para transformar a PoC no MVP jogável.

**Princípio orientador:** primeiro demonstrar de forma honesta que a IA consegue _tentar_ reconhecer o gesto; depois construir a mecânica completa em cima da evidência. Não sacrificar privacidade, separação de responsabilidades ou segurança das credenciais para acelerar uma demo.
