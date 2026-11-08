import { createContext, useContext } from 'react'
import type { CardLocale } from '@guess-my-move/core'
import { messages } from './messages.js'

/** Only the cards entry provides a locale; shared controls keep pt-BR elsewhere. */
export const LocaleContext = createContext<CardLocale>('pt-BR')
export function useI18n() {
    const locale = useContext(LocaleContext)
    return { locale, t: messages(locale) }
}
export function readCardLocale(): CardLocale {
    try {
        return localStorage.getItem('guess-my-move:cards-locale') === 'en-US'
            ? 'en-US'
            : 'pt-BR'
    } catch {
        return 'pt-BR'
    }
}
export function saveCardLocale(locale: CardLocale): void {
    try {
        localStorage.setItem('guess-my-move:cards-locale', locale)
    } catch {
        /* Optional preference only. */
    }
}
