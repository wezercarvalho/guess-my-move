import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const designDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'design')
const read = (name) => readFileSync(join(designDir, name), 'utf8')
const stylesheets = ['tokens.css', 'fonts.css', 'design.css']

/** Variáveis CSS declaradas em `:root` do tokens.css (nome sem `--` para valor). */
function readTokens() {
    const tokens = new Map()
    for (const match of read('tokens.css').matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) {
        tokens.set(match[1], match[2].trim())
    }
    return tokens
}

/** Resolve `var(--x)` até um valor concreto. */
function resolve(tokens, name) {
    let value = tokens.get(name)
    for (let depth = 0; depth < 5 && value?.startsWith('var(--'); depth++) {
        value = tokens.get(value.slice(6, -1))
    }
    return value
}

function luminance(hex) {
    const [r, g, b] = [1, 3, 5].map((i) => {
        const channel = parseInt(hex.slice(i, i + 2), 16) / 255
        return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Contraste WCAG 2.x entre duas cores #rrggbb. */
function contrast(a, b) {
    const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x)
    return (high + 0.05) / (low + 0.05)
}

const REQUIRED = [
    'ink',
    'paper',
    'gold',
    'gold-bright',
    'gold-hover',
    'muted',
    'paper-text-muted',
    'line',
    'surface',
    'surface-raised',
    'control-border',
    'success',
    'danger',
    'font-display',
    'font-body',
    'weight-regular',
    'weight-bold',
    'tracking-display',
    'tracking-eyebrow',
    'tracking-brand',
    'size-body',
    'size-small',
    'size-caption',
    'size-title',
    'size-heading',
    'space-1',
    'space-2',
    'space-3',
    'space-4',
    'space-5',
    'space-6',
    'space-7',
    'space-8',
    'radius',
    'motion-fast',
    'lift',
    'focus-color',
    'focus-width',
    'focus-offset',
    'touch-target',
]

describe('tokens de design', () => {
    const tokens = readTokens()

    it('declara todas as variáveis exigidas', () => {
        for (const name of REQUIRED) assert.ok(tokens.has(name), `falta --${name}`)
    })

    it('mantém a forma com raio zero e o foco dourado com 2px e offset de 5px', () => {
        assert.equal(tokens.get('radius'), '0')
        assert.equal(resolve(tokens, 'focus-color'), tokens.get('gold-bright'))
        assert.equal(tokens.get('focus-width'), '2px')
        assert.equal(tokens.get('focus-offset'), '5px')
    })

    it('usa as cores do site da referência', () => {
        assert.equal(tokens.get('ink'), '#090909')
        assert.equal(tokens.get('paper'), '#f6f4ef')
        assert.equal(tokens.get('gold'), '#c99400')
        assert.equal(tokens.get('gold-bright'), '#e0aa08')
        assert.equal(tokens.get('muted'), '#aaa8a0')
    })
})

describe('contraste (WCAG 2.x)', () => {
    const tokens = readTokens()
    const color = (name) => resolve(tokens, name)
    const backgrounds = ['ink', 'surface', 'surface-raised']

    it('texto principal, secundário, dourado, sucesso e erro têm 4,5:1 ou mais sobre as superfícies escuras', () => {
        for (const text of ['paper', 'muted', 'gold-bright', 'success', 'danger']) {
            for (const background of backgrounds) {
                const ratio = contrast(color(text), color(background))
                assert.ok(ratio >= 4.5, `${text} sobre ${background}: ${ratio.toFixed(2)}`)
            }
        }
    })

    it('texto tinta sobre o botão dourado (normal e hover) tem 4,5:1 ou mais', () => {
        for (const fill of ['gold-bright', 'gold-hover']) {
            const ratio = contrast(color('ink'), color(fill))
            assert.ok(ratio >= 4.5, `ink sobre ${fill}: ${ratio.toFixed(2)}`)
        }
    })

    it('borda de controle e anel de foco têm 3:1 ou mais sobre as superfícies escuras', () => {
        for (const control of ['control-border', 'focus-color']) {
            for (const background of backgrounds) {
                const ratio = contrast(color(control), color(background))
                assert.ok(ratio >= 3, `${control} sobre ${background}: ${ratio.toFixed(2)}`)
            }
        }
    })

    it('o dourado escuro sobre o papel reprova, por isso não é usado como texto sobre papel', () => {
        assert.ok(contrast(color('gold'), color('paper')) < 3)
    })

    it('reproduz os valores medidos registrados na pesquisa', () => {
        const round = (value) => Math.round(value * 100) / 100
        assert.equal(round(contrast('#f6f4ef', '#090909')), 18.12)
        assert.equal(round(contrast('#e0aa08', '#090909')), 9.41)
        assert.equal(round(contrast('#77756d', '#090909')), 4.31)
    })
})

describe('arquivos de estilo do design system', () => {
    it('nenhum url() aponta para http ou https (nada de CDN)', () => {
        for (const name of stylesheets) {
            const css = read(name)
            for (const match of css.matchAll(/url\(([^)]*)\)/g)) {
                assert.ok(!/https?:/i.test(match[1]), `${name}: ${match[0]}`)
            }
            assert.ok(!/@import\s+(?:url\(\s*)?['"]?https?:/i.test(css), `${name}: @import remoto`)
        }
    })

    it('cada @font-face aponta para um arquivo woff2 que existe, com font-display swap', () => {
        const css = read('fonts.css')
        const faces = [...css.matchAll(/@font-face\s*{([^}]*)}/g)].map((match) => match[1])
        assert.equal(faces.length, 2)
        for (const face of faces) {
            assert.match(face, /font-display:\s*swap/)
            const file = /url\('\.\/([^']+\.woff2)'\)/.exec(face)?.[1]
            assert.ok(file, 'src sem arquivo woff2 local')
            assert.ok(existsSync(join(designDir, file)), `arquivo ausente: ${file}`)
        }
        assert.match(css, /'DM Sans'/)
        assert.match(css, /'Space Grotesk'/)
    })

    it('as fontes têm o aviso da licença OFL ao lado', () => {
        for (const name of ['OFL-DM-Sans.txt', 'OFL-Space-Grotesk.txt']) {
            const text = readFileSync(join(designDir, 'fonts', name), 'utf8')
            assert.match(text, /SIL OPEN FONT LICENSE Version 1\.1/)
            assert.match(text, /^Copyright /)
        }
    })

    it('prefers-reduced-motion desliga a elevação e as transições dos componentes', () => {
        const css = read('design.css')
        assert.match(css, /@media \(prefers-reduced-motion: reduce\)/)
        assert.match(css, /transition:\s*none/)
        assert.match(css, /transform:\s*none/)
    })

    it('os componentes só usam cores dos tokens (nenhum #hex solto em design.css)', () => {
        assert.doesNotMatch(read('design.css'), /#[0-9a-fA-F]{3,8}\b/)
    })
})
