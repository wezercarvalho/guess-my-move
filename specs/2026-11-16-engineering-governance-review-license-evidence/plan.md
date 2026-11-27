# Plano

## Constitution Check — pré-design

- PASS: escopo e limites explícitos; origem e direitos não presumidos.
- PASS: base `2b76f0b14a2a33f2e98ab566ad36def61b1aa11e` e evidências do CI #178 conferidas.

## Design

Reconhecer somente o campo legado com entrada única e sem conflito. Preservar textos upstream por versão e blob Git; acrescentá-los aos índices sem elevar automaticamente o status. Gerar avisos do servidor e relatório dos arquivos compilados via biblioteca padrão Python 3 no job existente. Não usar scanner externo, não alterar dados/modelos nem adicionar dependência. Alternativa rejeitada: considerar licença Apache do SDK suficiente para todos os pesos ou bloquear build de desenvolvimento por falta de evidência.

## Constitution Check — pós-design

- PASS: nenhuma publicação, alteração de detector ou dependência.
- LIMITAÇÃO: hook local indisponível; execução oficial no CI remoto. ZIP não interpreta metadata FlatBuffers.

## Testes e desvios

Teste de regressão preparado em commit anterior à implementação. A ausência da função no código base torna a regressão RED por inspeção; a suíte RED oficial não foi executada. CI deve comprovar GREEN. Execução remota é a compensação pela limitação local, no escopo autorizado.
