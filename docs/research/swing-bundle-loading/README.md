# Carregamento do Arranha-Teia (#147)

## Decisão

Manter o empacotamento de produção. Extrair o Three.js para um arquivo estático separado não reduz significativamente os bytes necessários e não trouxe melhora consistente entre seleção, treino e lobby online. O aviso de tamanho continua visível; não foi aumentado seu limite. Uma eventual carga realmente adiada da cena exige outro incremento com spec, estados de carregamento/erro e testes de entrada local/online.

## Base e alternativa

Base: `b9335d5dba89a606a795108f00865fed8e7f411f`, main após #150. Mesmo código, ativos e dependências em ambos os builds. A configuração experimental `apps/web/vite.profile.config.ts` altera exclusivamente o agrupamento de módulos Three.js por `output.codeSplitting.groups`; o script de produção não a utiliza. Sem mudanças em física, mapa, detector, calibração, navegação ou UI.

Tamanhos medidos a partir dos arquivos emitidos, bytes exatos; gzip com o padrão do Node (`gzipSync`, nível 6). Não misturar esses números com o nível/formatador usado pelo reporter do Vite.

| Arquivo                     | Sem compressão |      gzip |
| --------------------------- | -------------: | --------: |
| Entrada Swing atual         |      687.933 B | 182.558 B |
| Entrada Swing experimental  |      126.988 B |  43.065 B |
| Three.js experimental       |      560.713 B | 139.207 B |
| Soma dos dois experimentais |      687.701 B | 182.272 B |

Redução de apenas 232 B sem compressão e 286 B gzip na soma; uma requisição adicional. A entrada de produção menor, sozinha, não seria evidência de redução do custo total.

## Ambiente e método

Medição em 08/11/2026: Linux x64, 2 CPUs disponíveis, AMD EPYC 9354P; Node 26.12.1, Yarn 4.18.1, Vite 8.3.4, Playwright 1.64.1 e Chromium 156.0.8078.4 headless. Browser já instalado em ambiente externo ao repositório, sem adicionar dependência à aplicação. GPU de software SwiftShader; viewport 1440 × 900; câmera desligada. Não há inferência neste ensaio.

Dois servidores HTTP em portas efêmeras, somente loopback, com gzip e política idêntica de cache: JS/CSS/fontes `max-age=31536000, immutable`, HTML/JSON `no-cache`. CDP aplica RTT de 150 ms, download 200.000 B/s, upload 93.750 B/s e slowdown de CPU 4×. Três repetições por variante/cenário, alternando a ordem; cada par fria/quente usa um novo contexto. Depois de medir prontidão fria, aguarda-se `networkidle` antes da navegação quente para completar o aquecimento do cache.

Prontidão é uma observação automatizada, não um marco de produtividade humana: seleção = título visível; treino = primeira chamada WebGL `clear`, sem medir quadros seguintes; lobby = tela online visível após clicar no modo. Os tempos incluem navegação, transferência, análise/execução, dados e espera do seletor automatizado. `readyMs` não isola parse de JavaScript nem mede FPS. Bytes de rede são os concluídos até esse instante, registrados por CDP; requisições ainda pendentes podem terminar depois. Por isso o tamanho estático também é registrado separadamente.

## Resultados

Medianas de três observações, em ms. [Dados individuais, tamanhos e recursos](results.json) permitem verificar dispersão, cache e instante de cada entrada.

| Cenário                    | Cache  | Atual | Three separado |
| -------------------------- | ------ | ----: | -------------: |
| Seleção de modo            | frio   | 2.916 |          2.749 |
| Seleção de modo            | quente |   916 |            793 |
| Primeiro desenho do treino | frio   | 3.596 |          3.425 |
| Primeiro desenho do treino | quente | 2.262 |          2.304 |
| Lobby online               | frio   | 2.975 |          3.021 |
| Lobby online               | quente |   960 |          1.071 |

As pequenas melhoras em seleção/treino frio não se repetem no treino quente ou no lobby. Com três amostras, servidor compartilhado e GPU de software, não se conclui ganho em produção nem significância estatística. O cache entre versões da aplicação não foi medido: um vendor separado poderia ajudar nesse cenário, mas isso é hipótese e não fundamento desta entrega.

## Reprodução

Instalar dependências e preparar os mesmos assets conforme o desenvolvimento local. Em um ambiente externo, instalar **Playwright 1.64.1** e seu Chromium, por exemplo:

```sh
npm install --prefix /tmp/gmm-profile playwright@1.64.1
/tmp/gmm-profile/node_modules/.bin/playwright install chromium
```

O runner aceita a instalação por caminho para manter o navegador fora das dependências da aplicação:

```sh
yarn workspace @guess-my-move/web build
yarn workspace @guess-my-move/web build:profile
GMM_PLAYWRIGHT_PATH=/tmp/gmm-profile/node_modules/playwright \
  yarn workspace @guess-my-move/web profile:swing
```

`GMM_CHROMIUM_PATH` pode indicar um executável específico; quando omitido, usa o browser correspondente ao Playwright. O argumento opcional de `profile:swing` define o arquivo JSON de saída. Rode sem outros builds/testes pesados concorrentes. A investigação registrada foi executada após a suíte agregada do lobby; comandos administrativos e a instalação seguinte podem causar ruído residual, outra razão para não extrapolar resultados.

O runner fecha contextos, navegador e servidores em `finally`, usa timeouts explícitos e falha se observar erro JavaScript/requisição no cenário. Não executa câmera nem gera mídia capturada. O script experimental não participa do build de produção; `dist-profile` é ignorado pelo Git. A configuração experimental e a base são verificadas por `typecheck`.

## Validação

Ambos os builds aprovados; 36 navegações medidas sem erros de página/requisição. O teste preserva entradas de seleção, treino e lobby; não cria sala online nem comprova uma partida ou câmera real. A aplicação de produção permanece igual à base; as suítes de aplicação existentes continuam como regressão, sem alegar novos testes de regras.

Investigação de risco baixo, sem mudança comportamental de produção: SDD opcional pelo roteador de estratégias; a decisão registrada aqui encerra o escopo da issue. Revisão/aceite e merge pendentes do maintainer.
