import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const webRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (name) => readFileSync(join(webRoot, name), 'utf8')

test('index.html carrega o menu', () => {
    assert.match(read('index.html'), /\/src\/home\/main\.tsx/)
})

test('cards.html carrega o jogo de cartas e volta ao menu', () => {
    const page = read('cards.html')
    assert.match(page, /\/src\/main\.tsx/)
    assert.match(page, /href="\.\/"/)
})

test('marbles.html carrega o bete e volta ao menu', () => {
    const page = read('marbles.html')
    assert.match(page, /\/src\/marbles\/main\.tsx/)
    assert.match(page, /href="\.\/"/)
})

test('o Vite tem uma entrada para cada página', () => {
    const config = read('vite.config.ts')
    assert.match(config, /main: 'index\.html'/)
    assert.match(config, /cards: 'cards\.html'/)
    assert.match(config, /marbles: 'marbles\.html'/)
})
