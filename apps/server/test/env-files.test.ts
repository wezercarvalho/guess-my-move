import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    rmSync,
    writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { ConfigModule, ConfigService } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ENV_FILE_PATHS, buildEnvFilePaths } from '../src/config/env-files.js'

async function loadConfig(serverDir: string): Promise<ConfigService> {
    const moduleRef = await Test.createTestingModule({
        imports: [
            ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: buildEnvFilePaths(serverDir),
            }),
        ],
    }).compile()
    return moduleRef.get(ConfigService)
}

describe('buildEnvFilePaths', () => {
    it('lista primeiro apps/server/.env e depois o .env da raiz', () => {
        expect(buildEnvFilePaths(join('/repo', 'apps', 'server'))).toEqual([
            join('/repo', 'apps', 'server', '.env'),
            join('/repo', '.env'),
        ])
    })

    it('resolve a partir do módulo, não do diretório atual', () => {
        const [server, root] = ENV_FILE_PATHS
        expect(server?.endsWith(join('apps', 'server', '.env'))).toBe(true)
        // A raiz é onde fica o package.json do monorepo (workspaces).
        expect(existsSync(join(dirname(root ?? ''), 'apps', 'server'))).toBe(
            true,
        )
    })
})

describe('carregamento do .env pelo ConfigModule', () => {
    let repo: string
    let serverDir: string
    const KEY = 'GMM_TEST_ENV_KEY'
    const ONLY_ROOT = 'GMM_TEST_ONLY_ROOT'

    beforeEach(() => {
        repo = mkdtempSync(join(tmpdir(), 'gmm-env-'))
        serverDir = join(repo, 'apps', 'server')
        mkdirSync(serverDir, { recursive: true })
        delete process.env[KEY]
        delete process.env[ONLY_ROOT]
    })

    afterEach(() => {
        rmSync(repo, { recursive: true, force: true })
        delete process.env[KEY]
        delete process.env[ONLY_ROOT]
    })

    it('lê o .env da raiz mesmo executando de apps/server', async () => {
        writeFileSync(join(repo, '.env'), `${ONLY_ROOT}=codex\n`)
        const config = await loadConfig(serverDir)
        expect(config.get(ONLY_ROOT)).toBe('codex')
    })

    it('apps/server/.env vence o .env da raiz', async () => {
        writeFileSync(join(repo, '.env'), `${KEY}=raiz\n`)
        writeFileSync(join(serverDir, '.env'), `${KEY}=servidor\n`)
        const config = await loadConfig(serverDir)
        expect(config.get(KEY)).toBe('servidor')
    })

    it('variável do ambiente do processo vence os arquivos', async () => {
        process.env[KEY] = 'processo'
        writeFileSync(join(repo, '.env'), `${KEY}=raiz\n`)
        const config = await loadConfig(serverDir)
        expect(config.get(KEY)).toBe('processo')
    })

    it('funciona sem nenhum arquivo .env', async () => {
        const config = await loadConfig(serverDir)
        expect(config.get(KEY)).toBeUndefined()
    })
})
