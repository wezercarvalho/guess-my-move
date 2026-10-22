import { describe, expect, it } from 'vitest'

import {
    MAX_CAUSE_LENGTH,
    REDACTED,
    describeCause,
} from '../src/guess/error-cause.js'

describe('describeCause', () => {
    it('inclui o nome e a mensagem do erro', () => {
        class CodexExecutionError extends Error {
            constructor(message: string) {
                super(message)
                this.name = 'CodexExecutionError'
            }
        }
        const text = describeCause(
            new CodexExecutionError('Codex CLI terminou com código 1'),
        )
        expect(text).toBe('CodexExecutionError: Codex CLI terminou com código 1')
    })

    it('colapsa quebras de linha e espaços repetidos', () => {
        expect(describeCause(new Error('a\n\n  b\t\tc'))).toBe('Error: a b c')
    })

    it('aceita valores que não são Error', () => {
        expect(describeCause('falhou')).toBe('falhou')
        expect(describeCause(undefined)).toBe('causa desconhecida')
        expect(describeCause({ a: 1 })).toBe('causa desconhecida')
    })

    it('redige base64 longo de frame', () => {
        const frame = 'QUJD'.repeat(40)
        const text = describeCause(new Error(`falha com ${frame} no meio`))
        expect(text).not.toContain(frame)
        expect(text).toContain(REDACTED)
    })

    it('redige data URI inteira', () => {
        const text = describeCause(
            new Error('x data:image/jpeg;base64,/9j/4AAQSkZJRg== y'),
        )
        expect(text).not.toContain('/9j/')
        expect(text).toContain(REDACTED)
    })

    it('redige credenciais do tipo Bearer e sk-', () => {
        const text = describeCause(
            new Error('Authorization: Bearer abc.def-123 e sk-proj-ABCdef123456'),
        )
        expect(text).not.toContain('abc.def-123')
        expect(text).not.toContain('sk-proj-ABCdef123456')
        expect(text).toContain(REDACTED)
    })

    it('limita o tamanho e preserva o final da mensagem', () => {
        const noise = 'prompt ecoado '.repeat(200)
        const text = describeCause(
            new Error(`${noise} ERROR: You've hit your usage limit`),
        )
        expect(text.length).toBeLessThanOrEqual(MAX_CAUSE_LENGTH)
        expect(text.endsWith("You've hit your usage limit")).toBe(true)
    })

    it('mantém texto curto e comum sem alteração', () => {
        expect(describeCause(new Error('timeout de 15000 ms'))).toBe(
            'Error: timeout de 15000 ms',
        )
    })
})
