# Teste do maintainer

## Executar

Na branch `feat/swing-guided-calibration`, use Node 26.12.1 e Yarn 4.18.1. Na raiz:

```sh
yarn install --immutable
yarn dev:web
```

Abra a URL informada pelo Vite e `/swing.html?mode=training`. Para cooperativo, execute também `yarn dev:server` em outro terminal e abra duas abas/contextos na mesma origem. O proxy Vite usa o servidor em `127.0.0.1:3000`.

## Conferência rápida

1. Sem ativar câmera, pressione Espaço: não deve lançar teia. Selecione Somente teclado e clique Iniciar com teclado; então Espaço deve lançar. Voltar ao início exige confirmação novamente.
2. Selecione Rosto e mãos e ative a câmera. Use o preview de apoio para enquadrar o rosto; depois olhe para o ponto no centro da cidade, fique imóvel e siga esquerda/centro/direita/centro/cima/centro/baixo/centro. As direções são as suas. Mostre uma palma (ou duas, conforme a escolha).
3. Faça positivo por cerca de 0,8 s (polegar para cima, quatro dedos fechados); depois abra a palma para liberar. Positivo mantido não pode puxar teia nem escalar. Teias, punho, palma, trava, escalada e giro contínuo continuam disponíveis após liberar.
4. Retire o rosto durante preparação, pare/reinicie câmera e troque modo. Nenhum desses casos deve aproveitar uma confirmação antiga. Centralizar com leitura atual deve nivelar o olhar sem mover o avatar.
5. No cooperativo, prepare cada pessoa ainda no lobby. Só uma pronta não inicia; ambas iniciam. Recalibrar durante espera retira prontidão. Retomada deve manter a tela/câmera; uma captura encerrada exige preparo novo. Uma sala já iniciada continua no servidor durante sua recalibragem local.
6. Durante todas as etapas, acompanhe o ponto central, a instrução e o progresso sobre a cidade. O preview pequeno na mesma área serve apenas para conferir enquadramento; para capturar o neutro, olhe para o ponto no centro da cidade. Não é necessário consultar a coluna lateral. Confira em janela larga e estreita e após Recalibrar controles.
7. Controle ocular permanece desabilitado nesta rodada. O ajuste dos olhos foi adiado pelo maintainer; não faz parte deste reteste.

## Matriz de câmera real (#161 e #162)

Registrar navegador/versão, câmera/resolução, iluminação e configuração, sem imagens, landmarks, nome pessoal ou vídeo. Para cada configuração (uma mão esquerda, uma direita, duas), fazer 10 preparações em luz frontal e 10 em luz reduzida. Anotar conclusão, tempo, repetições e falhas.

Fazer 10 negativos de cada tipo: punho, palma, polegar lateral, polegar para baixo, círculo de OK, positivo antes da calibragem e positivo breve. Qualquer início indevido exige correção e repetição daquele cenário.

Ensaio ocular adiado: quando o experimento for retomado, comparar cabeça versus cabeça+olhos nas mesmas tarefas (mirar prédio, consultar HUD, trocar direção, balançar). Anotar movimentos involuntários, tempo, percepção de atraso/conforto e condições; testar óculos se disponíveis. Sem generalizar taxa de acerto a partir dessa amostra. Ainda não executado em câmera física pelo agente.
