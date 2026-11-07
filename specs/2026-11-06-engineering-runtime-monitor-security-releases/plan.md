# Plano

## Design

Parte disponível de #132: política/monitor, sem fabricar patch futuro. Fontes fixas: índice nodejs.org/dist/index.json e calendário nodejs/Release/main/schedule.json. Comparação numérica de semver estável, independente da ordem do feed. Ignorar prereleases; rejeitar registros inválidos, pin ausente, major sem suporte e feeds vazios. Comparar security=true posterior ao pin. Release comum posterior é informativo.

Fetch sequencial com AbortSignal de 15 segundos, redirect:error, stream limitado a 2 MiB e JSON estrito. Não aceitar URLs por ambiente ou CLI, não executar conteúdo remoto, não persistir feed e não enviar dados da aplicação. CLI lê só .node-version e imprime resultado, sem afirmar ausência de vulnerabilidades.

Rotina diária/manual somente leitura e passo no job audit existente do pr-gate; seleção espelhada no hook inclui pin, script, biblioteca e workflow. Hook falha fechado para runtime. Não adicionar outro entrypoint pull_request. Testes puros e fetch simulado no test:gates; consulta real separada por security:runtime.

## Constitution Check — pré-design

- PASS: escopo autorizado, privacidade preservada e test-first antes da implementação.
- PASS: sem atualização automática, merge, deploy ou serviço pago.

## Alternativas e riscos

Atualizar para 26.13.0 isoladamente não corrige o advisory futuro: nota oficial diz que só altera metadados LTS. Bloquear todo release comum daria falso alerta de segurança. Um auditor não substitui leitura humana de advisories anunciados antes do release: responsável @wezercarvalho, próxima conferência 11/11/2026 Brasília, ou após se adiado. O índice pode conter flag security incompleta; não prometer segurança geral. Falha de rede reprova sem atribuir vulnerabilidade.

## Validação

Testes sintéticos com ordem invertida, prerelease, downgrade/patch, EOL, pin ausente, formato desconhecido, HTTP, redirect, timeout e resposta excessiva; estrutura de workflow/padrões de hook; scripts test:gates, test:sdd, sdd:check, docs:format:check e security:runtime.

## Constitution Check — pós-design

- PASS: implementação limitada a segurança operacional; nenhuma regra ou dado de jogo alterado.
- PASS: evidência técnica e aceite final separados; rollback por reversão do incremento.
