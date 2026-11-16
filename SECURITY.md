# Política de segurança

## Escopo e versões

O projeto está em desenvolvimento ativo. Relatos sobre o código atual da branch main e seus componentes são bem-vindos. Não há matriz de versões mantidas ou calendário de suporte publicado; não presumir suporte ou backport para revisões antigas.

Incluem-se vulnerabilidades de aplicação, dependências, CI, exposição de segredos e dados de câmera, fronteiras de informação e segurança das salas online. Bugs comuns sem implicação de segurança podem ser relatados pelas [issues](https://github.com/wezercarvalho/guess-my-move/issues).

## Como reportar uma vulnerabilidade

1. Prefira [Report a vulnerability](https://github.com/wezercarvalho/guess-my-move/security/advisories/new), o canal de reporte privado do GitHub, quando habilitado.
2. Se a opção estiver indisponível, solicite ao mantenedor um meio privado, sem incluir detalhes técnicos, dados pessoais, credenciais ou prova de conceito em público. A disponibilidade do canal privado precisa de confirmação administrativa; não se publica aqui um contato privado alternativo não verificado.
3. No canal privado, inclua versão ou commit afetado, descrição do impacto, condições de reprodução em ambiente próprio e sugestões de mitigação, se houver. Minimize e remova dados sensíveis.

**Não publique** detalhes de vulnerabilidades não corrigidas, segredos, tokens, imagens, vídeos, landmarks ou dados de terceiros em issues, PRs ou comentários públicos.

## Pesquisa responsável e tratamento

Teste apenas ambientes e contas sob sua autorização. Não acesse dados de terceiros, interrompa serviços ou explore sistemas reais para demonstrar impacto. Interrompa o teste se encontrar dados sensíveis.

O mantenedor avaliará o relato conforme sua disponibilidade, poderá solicitar esclarecimentos e combinará a divulgação após avaliação e correção, quando aplicável. Não há SLA, programa de recompensa ou garantia de prazo. Não é necessário reproduzir uma falha em produção para reportá-la.

Consulte também a [política de privacidade e segredos](docs/development-context/security/privacy-and-secrets.md), a [segurança do runtime](docs/development-context/security/runtime-node.md) e o [guia de contribuição](CONTRIBUTING.md).
