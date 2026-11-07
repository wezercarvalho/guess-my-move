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
