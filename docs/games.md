# Como jogar

O menu inicial oferece três jogos. Use Chrome desktop com webcam, permita o acesso à câmera e mantenha as mãos visíveis, com boa iluminação. O vídeo e os pontos de referência aparecem espelhados. O reconhecimento é experimental: distância, enquadramento, iluminação e taxa de quadros podem mudar o resultado.

## Cartas de gestos

Abra `/cards.html`. Português brasileiro é o padrão; **Idioma** permite inglês, com preferência local opcional. Selecione categoria, dificuldade e carta. Há quatro cartas: Acenar, Despedida animada, Limpador de para-brisa e Regente de orquestra, distribuídas entre Cumprimentos, Cotidiano e Artes. Todas usam oscilação da mão: o avaliador reconhece esse movimento, não o significado da mímica. Trocar carta, idioma ou modo encerra a captura/rodada anterior.

No **Treino local**, ative a câmera e use **Começar**; reconhecimento e prazo vêm do núcleo local. Dica e sugestão ficam escondidas até você pedir. Não há pontuação competitiva nem transmissão de sinais.

No **Competitivo experimental**, inicie o backend conforme o README. A tela avisa antes de começar: apenas ângulo da mão/null e sequência são enviados à mesma origem; imagens, vídeo e landmarks permanecem no navegador. O servidor seleciona seus próprios metadados por id e usa seu relógio para decidir reconhecimento e prazo. Falha de rede não concede pontos nem troca silenciosamente para treino. **Cancelar**, trocar seleção ou parar a câmera encerra a tentativa.

Regras atuais: 10 s por rodada; pontos-base 100 em cartas fáceis e 200 em médias. Acerto vale `round(basePoints × (1 − elapsedMs / (2 × durationMs)))`; quanto mais cedo, maior a pontuação. O limite exato já é timeout. Cancelamento, timeout e falha valem zero; dicas não alteram pontos nesta versão. Resultado final confirmado pelo servidor não pode ser pontuado outra vez. A contagem regressiva da tela é indicativa entre confirmações, sem autoridade sobre o resultado.

Não há contas, ranking ou premiação. Ângulos recebidos do dispositivo podem ser fabricados; o protocolo não prova identidade, presença ou gesto físico. A autoridade de avaliação/tempo/pontuação no servidor não resolve esse problema de antifraude. Reconhecimento real dessas cartas ainda requer testes em câmeras e pessoas diferentes.

### Contrato competitivo

O [OpenAPI exportado](../contracts/http.openapi.json) descreve os corpos e respostas estritos:

- `POST /api/cards/rounds`: `{ cardId, locale }`; cria acesso privado `{ roundId, token, round }`.
- `POST /api/cards/rounds/{id}/observe`: `{ seq, angleDeg }`, com `Authorization: Bearer <token>`; `angleDeg: null` atualiza prazo sem mão.
- `POST /api/cards/rounds/{id}/cancel`: `{}` com o mesmo token; resultado final é idempotente.

Exige origem permitida pela configuração existente. Não enviar tokens em URL, logs ou storage persistente. Corpo JSON limitado a 2.048 B, sem compressão; observações com pelo menos 50 ms de intervalo. O cliente mantém uma requisição por vez e intervalo mínimo de 120 ms. Há no máximo 100 rodadas por processo; tentativas de início compartilham o limite agregado por endereço dos jogos. Rodadas expiram no máximo 30 s após o prazo de execução, com varredura a cada segundo. As cartas atuais têm duração de 10 s, portanto TTL de 40 s mais até 1 s da varredura; acessos expirados são recusados imediatamente na próxima operação. Uma criação cujo ACK HTTP se perde pode reservar capacidade até esse TTL; não se repete automaticamente.

Para testar o protocolo sem câmera: `yarn workspace @guess-my-move/server test:cards`. Seleção, traduções e descarte: `yarn workspace @guess-my-move/web test:cards`. Testes não medem acurácia visual. O painel técnico do treino permanece em português; os demais jogos mantêm seus idiomas atuais.

### Demonstração automatizada no navegador

Após `yarn build`, `yarn workspace @guess-my-move/web smoke:cards` executa frontend compilado, servidor compilado e câmera sintética do Chromium em portas temporárias. Exige instalação externa de Playwright 1.64.1 indicada por `GMM_PLAYWRIGHT_PATH`; `GMM_CHROMIUM_PATH` é opcional. Pode reutilizar o preparo externo documentado na [investigação de carregamento](research/swing-bundle-loading/README.md#reprodução). É uma demonstração opcional, fora do gate padrão e sem nova dependência da aplicação. O argumento opcional define um JSON sanitizado de resultado; não gera imagens ou vídeos, não registra tokens/sinais e desativa coleta externa. Comprova seleção, inglês, preferência após reload, carregamento real do detector e timeout competitivo sem mão com zero pontos. Não mede reconhecimento de gestos com câmera física.

## Bolinhas de gude

Abra `/marbles.html` e escolha **Bete**, **Triângulo** ou **Cova**. No modo local, escolha a meta ou o bot como adversário; no online, siga as [instruções para criar e entrar em uma sala](../README.md#jogar-bolinhas-online). As instruções na tela mostram o objetivo de cada modo.

### Pinça

Una polegar e indicador, arraste a mão para longe do alvo e abra os dedos para atirar. A mira usa o deslocamento desde o fechamento da pinça; a força depende do arrasto. A mão pode começar em qualquer ponto do enquadramento.

### Estalo experimental

Feche a mão com o polegar junto ao indicador, afaste a mão do alvo para mirar e estique o polegar rapidamente, mantendo-o esticado. A direção vem do arrasto; a força vem da rapidez de abertura. O painel **Etapas do estalo** ajuda a acompanhar a sequência.

A interface pode cancelar o tiro por força insuficiente, falta de mira, abertura não sustentada ou palma aberta. Movimentos rápidos podem escapar da captura da webcam. Os limiares e ganhos precisam de validação em mais pessoas e dispositivos. Também é possível selecionar esse modo com `?mode=estalo`.

### Sala online

Apelidos distinguem as duas pessoas. Confira participantes, prontidão e conexão antes de começar. Durante a partida, a interface mostra a vez atual, a situação das bolinhas e o próximo jogador conforme o andamento da rodada. Ao final, o resultado e as confirmações de revanche permitem iniciar outra partida na mesma sala.

Uma queda de conexão pausa o jogo por até 60 segundos. Recarregar a mesma aba permite retomar o lugar usando a credencial de sessão. **Sair da sala** encerra a sala; não use essa ação para pedir revanche.

## Arranha-Teia

Abra `/swing.html` e escolha uma experiência:

- **Treino:** Aurora, uma cidade procedural de néon, com exercícios de comandos sem tempo nem pontuação.
- **Cooperativo online:** duas pessoas na mesma cidade, com avatares identificados e sinais luminosos para coletar em conjunto. Requer o servidor; câmera é opcional.
- **Viajante:** cidades reais do catálogo, incluindo Midtown Manhattan, Avenida Paulista e Santa Maria, com dados do OpenStreetMap.

### Cooperação online

1. Inicie o servidor e a web conforme o README; escolha **Cooperativo online**.
2. Informe um apelido, selecione a cidade e crie a sala. Compartilhe o código com a outra pessoa, que informa seu próprio apelido e entra na sala.
3. Confiram os dois nomes e confirmem **Estou pronto**. Os avatares usam as cores da lista; o apelido identifica a outra pessoa no cenário.
4. Alcancem os sinais luminosos próximos ao chão; cada sinal é coletado uma vez por qualquer participante. A contagem é coletiva e o servidor confirma a conclusão.
5. Ao concluir, as duas pessoas confirmam **Nova partida** na mesma sala. A câmera e o mundo permanecem montados.

Se a conexão continuar aberta mas a partida ficar sem progresso por dois segundos, a tela mostra **Aguardando atualização do servidor**. Os controles param de enviar comandos até chegar um snapshot novo; sala e câmera são preservadas e a retomada é automática. Isso é diferente da mensagem de desconexão.

A sessão pausa quando alguém desconecta. A vaga fica reservada por 60 segundos e a reconexão acontece automaticamente. Recarregar a página perde a credencial mantida só em memória; sair libera a vaga. Salas expiradas retornam ao lobby com uma mensagem. A interface aceita teclado e gestos; imagens, vídeo e landmarks continuam locais. Reiniciar o servidor perde as salas.

### Mãos e teias

Faça a pose de teia: polegar, indicador e mindinho abertos, médio e anelar dobrados. A mão esquerda lança para a esquerda; a direita, para a direita. Cada mão mantém sua própria teia. Fechar o punho puxa; abrir a palma solta a teia.

A mira escolhe automaticamente um ponto alcançável à frente; uma âncora no céu funciona como alternativa. Ao tocar uma parede, abra a mão para agarrar. Desça uma mão por vez para subir; feche o punho para soltar. O guia e as mensagens sobre o jogo indicam a ação reconhecida e o próximo passo.

### Olhar e calibragem

Em **Direção do olhar → Rosto**, vire a cabeça para ajustar a câmera nos lados, para cima e para baixo. Aguarde a detecção e a calibragem com a cabeça estável, olhando para o centro da tela. Use **Sensibilidade do rosto** para ajustar quanto a câmera gira nos dois eixos: 1× mantém o ganho padrão, valores maiores respondem mais ao mesmo movimento e valores menores suavizam o giro (0,5×–3×). A alteração é aplicada suavemente, sem recarregar o detector, e não muda o esforço da escalada. A preferência vale nesta tela, inclusive ao reiniciar ou alternar a direção do olhar; ao abrir outra tela, volta ao padrão. Use **Centralizar** para refazer o neutro e nivelar suavemente a câmera ao horizonte: mirando a fachada enquanto agarrado, o rumo do deslocamento se em movimento, ou a direção inicial quando parado. Isso não reposiciona o personagem. Se o rosto sair do quadro, a primeira nova leitura válida define o neutro automaticamente, sem salto.

Uma mão aberta com o dedão para baixo trava a direção enquanto a pose é mantida, permitindo voltar a olhar para o monitor. O gesto recalibra o neutro; ao soltar, a pose atual vira o novo centro, sem somar de novo o movimento feito enquanto a direção estava travada. Recuperar o rosto durante a trava mantém a direção escolhida. No modo Rosto, enquanto estiver agarrado, olhar para cima ou para baixo por dois segundos inicia a subida ou descida; olhar para o lado interrompe o movimento. O modo **Automática** usa o acompanhamento do movimento sem carregar o detector de rosto.

A velocidade exibida inclui a subida e a descida agarrado (até 6 m/s, ou 21,6 km/h), sem impulso extra ao soltar a parede. A descida para na altura do chão. A distância percorrida continua medindo o deslocamento horizontal.

A âncora virtual no céu é oferecida até **500 m de altura do personagem**, inclusive. Acima disso, a teia ainda pode prender em prédios: o alcance é **160 m**, e a âncora precisa estar pelo menos 12 m acima e 15 m afastada na horizontal. Sem uma âncora válida, o lançamento falha; não é um limite geral de altitude para toda teia.

Para girar continuamente, mantenha o rosto virado para esquerda ou direita por **1 segundo**. O painel mostra a espera e a direção do giro; volte o rosto ao centro para parar. A taxa base padrão é 30°/s e acompanha a sensibilidade (15–90°/s). Ao manter a mesma intenção por mais de **2,5 s no total**, incluindo a espera inicial, o giro acelera gradualmente até **2× a taxa base aos 5 s** (máximo de 180°/s na sensibilidade 3×). O painel informa o multiplicador; parar ou trocar de lado reinicia a aceleração. Pequenos desvios ficam na zona neutra; trocar de lado reinicia a espera. Perder o rosto, ficar sem leitura nova por mais de 250 ms, travar a direção, usar setas horizontais, centralizar, reiniciar ou mudar o modo interrompe o giro contínuo. A direção acumulada é preservada ao voltar ao centro; o botão Centralizar nivela novamente a câmera. O giro vertical continua proporcional à pose, sem rotação contínua.

### Teclado

| Tecla     | Ação                                                                            |
| --------- | ------------------------------------------------------------------------------- |
| `Espaço`  | Lançar teia ao centro.                                                          |
| `Z` / `X` | Lançar teia à esquerda / direita.                                               |
| `C`       | Puxar.                                                                          |
| `V`       | Agarrar a parede em contato.                                                    |
| Setas     | Ajustar o olhar; para cima/baixo também controlam a escalada enquanto agarrado. |

Segure a tecla de lançamento para manter a teia e solte para liberá-la. O painel **Teclado** fica disponível durante o jogo.

## Depuração e limitações

Os painéis de depuração ajudam a conferir mãos, gestos e estados reconhecidos. Para comparar o processamento do detector, use `?delegate=gpu` ou `?delegate=cpu`; forçar uma opção desativa o recuo automático para a outra. Sem opção explícita, o detector tenta GPU e recua para CPU se a criação falhar.

O desempenho depende do dispositivo e da execução conjunta dos detectores de mãos e rosto. Ainda não há garantia geral de precisão, latência ou FPS. As revisões de calibragem e alinhamento precisam de testes com câmera real em diferentes ambientes.

A física é ajustada para o jogo, não uma simulação realista. Nos mapas reais, alturas ausentes são estimadas e a conversão de edifícios simplifica a geometria, incluindo pátios internos. Consulte as [specs e seus registros de validação](../specs/README.md) para conhecer as evidências e pendências de cada entrega.
