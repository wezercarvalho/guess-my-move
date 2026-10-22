import type { ConfigService } from '@nestjs/config'

import type { EnvironmentVariables } from './environment.js'

/**
 * Linha de boot que diz qual provedor responde as tentativas. Evita confundir
 * o `mock` (palpite fixo) com um modelo real. Sem credenciais: só o nome do
 * provedor e, no `codex`, o modelo e o esforço configurados.
 */
export function describeActiveProvider(
    config: ConfigService<EnvironmentVariables, true>,
): string {
    const provider = config.get('GUESSER_PROVIDER', { infer: true })
    if (provider === 'codex') {
        const model = config.get('CODEX_MODEL', { infer: true }) ?? '(sem modelo)'
        const effort = config.get('CODEX_REASONING_EFFORT', { infer: true })
        return `Provedor ativo: codex (modelo ${model}${effort ? `, esforço ${effort}` : ''})`
    }
    return 'Provedor ativo: mock (palpite fixo "acenar", sem modelo real)'
}
