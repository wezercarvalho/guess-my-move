import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const webDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (...parts) => readFileSync(join(webDir, ...parts), 'utf8')

const swingHtml = read('swing.html')
const swingCss = read('src', 'swing', 'swing.css')
const stylesCss = read('src', 'styles.css')

/** Corpo da primeira regra cujo seletor é exatamente `selector`. */
function ruleBody(css, selector) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? ''
}

/**
 * Contrato do layout do Arranha-Teia (spec 2026-10-31-game-arranha-teia-refine-fluid-layout-and-feedback).
 * O CSS não é medido no jsdom, então estes testes só travam as decisões que garantem "sem rolagem"
 * e "mensagens fora do centro". A medição real em Chromium fica em validation.md.
 */
describe('layout do Arranha-Teia', () => {
    it('a página do jogo marca o body para limitar a altura só nela', () => {
        assert.match(swingHtml, /<body[^>]*class="swing-page"/)
        // As outras páginas não recebem a classe.
        for (const page of ['index.html', 'cards.html', 'marbles.html']) {
            assert.doesNotMatch(read(page), /swing-page/, page)
        }
    })

    it('o layout fluido vale a partir de 960 x 560 px e fixa a altura do corpo só aí', () => {
        const media = /@media \(min-width: 960px\) and \(min-height: 560px\) \{([\s\S]*?)\n\}\n/.exec(swingCss)?.[1] ?? ''
        assert.match(media, /body\.swing-page\s*\{[^}]*height:\s*100dvh/)
        assert.match(media, /body\.swing-page\s*\{[^}]*overflow:\s*hidden/)
        assert.match(media, /\.swing-side\s*\{[^}]*overflow-y:\s*auto/)
        assert.match(media, /\.swing-stage\s*\{[^}]*aspect-ratio:\s*auto/)
        // Fora do media query a página não é travada.
        assert.doesNotMatch(swingCss.replace(media, ''), /body\.swing-page\s*\{[^}]*height:\s*100dvh/)
    })

    it('o contêiner de preenchimento existe e o app-wide das outras páginas não muda', () => {
        assert.match(ruleBody(stylesCss, '.app.app-fill'), /max-width:\s*none/)
        assert.match(ruleBody(stylesCss, '.app.app-wide'), /max-width:\s*1360px/)
    })

    it('as mensagens ficam coladas na base do palco, centradas, e não pegam o mouse', () => {
        const block = ruleBody(swingCss, '.swing-feedback')
        assert.match(block, /pointer-events:\s*none/)
        assert.match(block, /bottom:/)
        assert.match(block, /left:\s*50%/)
        assert.doesNotMatch(block, /top:/)
    })

    it('a gaveta de depuração flutua sobre o jogo, com rolagem própria', () => {
        const block = ruleBody(swingCss, '.swing-screen .ds-drawer')
        assert.match(block, /position:\s*fixed/)
        assert.match(block, /overflow-y:\s*auto/)
    })
})
