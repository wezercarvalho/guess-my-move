import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Arquivos `.env` lidos pelo servidor, do mais ao menos prioritário:
 * `apps/server/.env` e o `.env` da raiz do monorepo. Variáveis já definidas no
 * ambiente do processo vencem ambos (comportamento do `@nestjs/config`).
 *
 * Os caminhos partem do diretório do pacote do servidor, e não do diretório
 * atual: `yarn dev:server` executa com `cwd` em `apps/server`, enquanto o
 * README manda criar o `.env` na raiz.
 */
export function buildEnvFilePaths(serverDir: string): string[] {
    return [join(serverDir, '.env'), join(serverDir, '..', '..', '.env')]
}

// `src/config` e `dist/config` ficam a dois níveis de `apps/server`.
const SERVER_DIR = fileURLToPath(new URL('../..', import.meta.url))

export const ENV_FILE_PATHS: string[] = buildEnvFilePaths(SERVER_DIR)
