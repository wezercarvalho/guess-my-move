import 'reflect-metadata'

import { createServerApp } from './app.setup.js'
import { loadServerConfig } from './server-config.js'

export async function bootstrap(): Promise<void> {
    const config = loadServerConfig(process.env)
    const app = await createServerApp()
    app.enableShutdownHooks()
    await app.listen(config.port, '127.0.0.1')
}

if (process.env.NODE_ENV !== 'test') {
    void bootstrap()
}
