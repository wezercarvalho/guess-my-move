import { defineConfig } from 'vitest/config'

// Os pacotes workspace expõem `src` na condição `source` e `dist` no runtime Node.
// Os testes resolvem pelo código-fonte, sem exigir build prévio.
export default defineConfig({
    resolve: { conditions: ['source'] },
    ssr: { resolve: { conditions: ['source'] } },
})
