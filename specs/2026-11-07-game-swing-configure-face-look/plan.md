# Plano

## Design

O núcleo HeadLook passa a marcar recuperação após amostra perdida válida para processamento e, ao receber nova orientação válida, a define como neutro. Sem trava, limpa o viés como Centralizar e suaviza o desvio restante; travado, preserva viés/modo e só redefine a pose neutra. Nas transições de trava, recalibra a pose atual e conserva a direção escolhida pelo lookback. Renderização repetida não arma nem resolve recuperação; não reinicia a calibração em cada quadro.

HeadLook recebe a preferência limitada e aplica o fator apenas ao alvo visual dentro de maxYaw/maxPitch, antes da suavização existente. A direção travada já é um ângulo visual e não é reescalada quando o ganho muda. Dois sinais separados (gestureYaw/gesturePitch) mantêm o desvio com ganho padrão para HeadClimb; mudar preferência visual não altera limiares ou esforço de escalada. Isso evita duplicar o pipeline de calibração ou reconstruir viés travado na camada de tela. O reset preserva a preferência; uma nova instância volta a 1×.

Snapshot/setter/hook expõem a opção à SwingScreen, que é compartilhada pelo local e cooperativo. Slider com rótulo, saída de valor e instrução; não cria câmera, storage ou payload. Faixa limitada 0,5–3 evita amplitude arbitrária, mantendo limites físicos da câmera. Reinício/alternância preservam preferência na instância.

## Constitution Check — pré-design

- PASS: issue e gates autorizados pelo maintainer; spec antes do código.
- PASS: testes de comportamento precedem as tarefas; sem provedor/custo/dados externos.

## Alternativas e riscos

Não multiplicar entrada do detector nem limiares de escalada: alteraria outro controle. Não recriar detector para ajustar preferência. Não zerar o mundo ao recentralizar: o pedido é redefinir neutro. Ganho em extremo fica limitado pelos ângulos e converge suavemente; durante a trava não altera o olhar congelado. Ajustar expectativas antigas que somavam a mesma pose depois de soltar a trava, registrando a mudança intencional. Câmera real permanece como aceite humano.

## Validação

T001: testes núcleo de recuperação/trava e frame repetido, controlador de ganho/limites/transição sem recarga e UI acessível antes da implementação. T002: escalada, calibração inicial, lock lookback, centralização manual e local/online com regressões. Scripts oficiais: pacote Swing test, web test:swing-controls, web test e check:all; SDD, formatação e hook. Sem nova dependência.

## Constitution Check — pós-design

- PASS: composição existente e mesma tela, sem duplicar HeadLook ou pipeline de calibração.
- PASS: sem contrato de rede novo ou persistência; Gate 3 final não presumido.

## Descoberta na demonstração de sensibilidade

Os testes de limites e proporção revelaram que world.advance aplicava o mesmo lookDelta em cada subpasso físico, duplicando o giro em um render de 16 ms (dois passos de 1/120 s). Isso impede respeitar a sensibilidade/limites de forma consistente. Acrescentar testes vermelhos para múltiplos subpassos, renders sem passo e reset; acumular deltas pendentes e consumi-los uma única vez no primeiro passo. World.step permanece igual e o servidor já retira lookDelta após o primeiro passo. Nenhuma regra física ou taxa de teclado é alterada. A expectativa antiga de giro duplicado após soltar a trava é substituída pelo novo neutro, conforme FR-003.

Alta sensibilidade e travas sucessivas podem acumular um viés de yaw acima de meia volta. Demonstrar o contrato online e a centralização por caminho curto: normalizar somente a representação angular de bias/delta enviada à simulação e o offset ao centralizar, mantendo formatos/limites do protocolo e a direção equivalente. Evita rejeição de input cooperativo e giros longos ao redefinir o neutro.

## Emenda após teste do maintainer

O pedido explícito nesta conversa autoriza corrigir a velocidade de escalada e tornar o botão Centralizar um alinhamento efetivo da câmera. A mesma PR em draft recebe a emenda. No núcleo, recenter aceita opcionalmente o desvio total atual da câmera em relação ao rumo desejado; o controlador usa o mesmo desvio como já aplicado. A suavização existente remove esse resíduo sem salto, sem pipeline paralelo ou teleporte e sem novo payload. Rumo: normal da parede para dentro, velocidade horizontal significativa ou zero inicial. Pitch alvo zero. Recuperação e gesto continuam preservando sua semântica, apenas o botão alinha a câmera inteira.

Na escalada, velocity representa a velocidade real; zerar seus componentes no próprio objeto antes das saídas impede que o integrador retenha uma referência antiga com impulso vertical. Após colisão/limites, calcular o deslocamento vertical efetivo por dt e atualizar topSpeed. Respeitar a altura mínima do olho na descida agarrada (o retorno antecipado desse regime antes não passava pela resolução do chão). Não alterar distância horizontal, velocidade máxima da escalada, lançamento ou schema. Demonstrar testes vermelhos de indicador/velocidade/soltura e alinhamento partindo de câmera inclinada, em repouso, movimento e agarre.

Emenda adicional autorizada pelo maintainer: elevar maxAltitude de 220 para 500 m. O valor é configuração do núcleo compartilhada por cliente/servidor; manter os demais parâmetros e testar 500 m, imediatamente acima e prédio válido acima.

## Revisão da saída da parede

Dois testes vermelhos demonstraram que zerar velocity ao sair descartava também o impulso explícito aplicado por world.step antes da integração. Preservar somente a diferença de velocidade criada pelos comandos nesse passo (snapshot anterior às teias), passando-a como contexto interno PlayerStep/GripInput. StepGrip continua zerando a velocidade comandada da escalada, mas restaura o impulso deliberado na saída por teia. O campo não pertence a SwingInput nem à rede; não é decidido pelo cliente. Preserva a ordem de integração e evita atrasar o impulso em um passo ou introduzir inércia da escalada. Validar com velocidades prévias zero/6 e com lançamento sem puxão, além de saídas, topo, regressões e contratos existentes.

## Giro contínuo após 1 segundo

Pedido explícito do maintainer nesta conversa autoriza FR-007/T009. Compor um HeadTurn puro que lê intentYaw sem suavização e independente da sensibilidade, espera 1000 ms, usa histerese 12°/7°, limita a contribuição de um frame a 100 ms e exige amostra renovada em até 250 ms. O delta é 30°/s vezes a preferência, sem giro contínuo de pitch. HeadLook.turnYaw incorpora esse delta na direção-base e no offset aplicado, mantendo os sinais de escalada independentes e o histórico de trava coerente. O controlador continua enviando só lookDelta/lookBias existentes, consumidos uma vez pelo mundo. Neutralizar a pose não desfaz o giro acumulado; centralização manual e recuperação seguem o comportamento aprovado. Resetar relógios nas saídas e reinício, sem recarregar detectores. Snapshot/UI mostram espera e giro. Atualizar testes antigos que supunham pose lateral ilimitadamente parada; manter testes de limite posicional antes de 1 s.

A validação anterior sobre 07fac85 passou no núcleo/servidor, mas teve um timeout de 5 s em um teste web de modo automático, sob carga. As fixtures criavam um canvas por chamada de superfície e geravam avisos em cada quadro. Reusar o canvas no cenário, como no produto, e simular seu contexto null já existente; usar no-op estável nos métodos de desenho dos efeitos, sem criar um vi.fn por leitura de propriedade em milhares de quadros. Evita DOM/logs e registros de mock descartáveis sem aumentar timeout. Revalidar o teste no conjunto final.

A regressão de retornar ao centro logo antes do prazo revelou disparo durante a cauda de suavização de gestureYaw (0,075 rad indevidos). Separar intentYaw instantâneo da suavização visual/escalada impede disparar ou continuar giro quando a pose já voltou ao neutro. Mantém os sinais existentes da escalada.

## Aceleração por permanência lateral

Pedido explícito do maintainer autoriza FR-008/T010: ampliar HeadTurn com início da aceleração em 2500 ms totais, rampa de 2500 ms e teto de 2×. Reusar o relógio de intenção e seus resets. Integrar analiticamente a taxa linear no intervalo de cada frame para que frames de 20/100 ms acumulem a mesma rotação extra, sem alterar o primeiro segundo de espera. Manter ganho/base atuais, limitações de renovação de amostra e frame longo. Expor apenas o multiplicador no snapshot local e feedback; nenhum payload novo. Test-first de fronteiras, simetria, teto, subdivisão, resets/interrupções, controlador e texto. Ganho máximo 3× e teto 2× limitam taxa a 180°/s.
