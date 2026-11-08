// Local fallback: compile the server with official scripts before using this config.
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../../../apps/server/', import.meta.url)).replace(/\/$/, '')
export default {
    root,
    resolve: { conditions: ['source'] },
    ssr: { resolve: { conditions: ['source'] } },
    plugins: [{name:'local-production-compiled-server',enforce:'pre',resolveId(source,importer){
        if(importer?.includes('/apps/server/test/') && source.startsWith('../src/')) return root+'/dist/'+source.slice('../src/'.length)
    }}],
    test: { environment:'node',include:['test/**/*.test.ts'],maxWorkers:2 },
}
