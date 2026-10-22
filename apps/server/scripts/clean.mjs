// Remove o `dist` antes do build, para que arquivos apagados do código-fonte não
// sobrevivam na saída (o `tsc` não limpa o diretório de saída).
import { rmSync } from 'node:fs'

rmSync(new URL('../dist', import.meta.url), { recursive: true, force: true })
