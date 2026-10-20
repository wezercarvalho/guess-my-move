# Privacidade e segredos

Aplica-se a qualquer mudança que toque câmera, frames, chamadas a provedor de IA, logs, variáveis de ambiente ou documentação para usuários.

## Câmera e frames

- Solicite consentimento explícito do navegador, mostre um indicador de câmera ativa e permita parar a captura a qualquer momento.
- Capture frames somente sob comando do jogador (janela curta, sem streaming contínuo na PoC) e descarte-os após o uso.
- Não persista imagens nem vídeos por padrão e não registre dados de imagem (base64, bytes, miniaturas) em logs ou telemetria.
- Informe ao usuário, de forma clara, quando e para qual provedor externo os frames são enviados.
- Em conteúdo de menores, aplique salvaguardas adequadas antes de ampliar o público.

## Provedores de IA

- A escolha do provedor considera retenção, uso para treinamento, região de processamento e residência de dados. Não presuma garantias idênticas entre provedores: cite a política oficial e a data de verificação em [`docs/research`](../../research/multimodal-model-selection.md).
- Use o plano/contrato em que as entradas **não** são usadas para treinamento (verifique no provedor, por exemplo, camadas gratuitas x pagas).
- Reduza a transmissão: menos frames, menor resolução e janelas curtas diminuem custo, latência e exposição.

## Chaves e configuração

- Credenciais ficam somente no servidor, em variáveis de ambiente. **Nunca** no bundle do navegador, em logs ou no repositório.
- Mantenha `.env.example` com placeholders e `.env*` no `.gitignore`.
- Prefira identidade/role de infraestrutura (por exemplo, IAM) a chaves estáticas de longa duração; se usar chave, restrinja o escopo.
- Aplique limites de payload (frames, tamanho, duração), rate limit e teto de custo nas rotas que chamam o provedor; a rota não pode permitir consumo irrestrito da chave.

## Observabilidade sem mídia

Registre apenas eventos como `round_started`, `frames_captured` (contagem), `guess_received`, `provider_failed` com `round_id` e tempos. Nunca o conteúdo bruto.
