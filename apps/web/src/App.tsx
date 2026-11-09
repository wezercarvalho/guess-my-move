import { getCards, toPublicCard, type CardLocale } from '@guess-my-move/core'
import { useState } from 'react'
import { CompetitiveScreen } from './cards/CompetitiveScreen.js'
import { LocaleContext, readCardLocale, saveCardLocale } from './i18n/locale.js'
import { messages } from './i18n/messages.js'
import { GestureScreen } from './round/GestureScreen.js'

export function App() {
    const [locale, setLocale] = useState<CardLocale>(readCardLocale)
    const [category, setCategory] = useState('all')
    const [difficulty, setDifficulty] = useState('all')
    const [id, setId] = useState('wave-001')
    const [mode, setMode] = useState('local')
    const t = messages(locale)
    const deck = getCards({ locale })
    const categories = [
        ...new Set(
            deck
                .map((entry) => entry.public.category)
                .filter((value): value is string => value !== undefined),
        ),
    ]
    const difficulties = [
        ...new Set(
            deck
                .map((entry) => entry.public.difficulty)
                .filter((value): value is string => value !== undefined),
        ),
    ]
    const categoryNames: Record<string, string> = {
        greetings: t.greetings,
        everyday: t.everyday,
        arts: t.arts,
    }
    const difficultyNames: Record<string, string> = {
        easy: t.easy,
        medium: t.medium,
    }
    const available = getCards({
        locale,
        ...(category === 'all' ? {} : { category }),
        ...(difficulty === 'all' ? {} : { difficulty }),
    })
    const card = available.find((value) => value.id === id) ?? available[0]
    return (
        <LocaleContext value={locale}>
            <main className="app" lang={locale}>
                <header className="app-header">
                    <h1>Guess My Move</h1>
                    <p>{t.intro}</p>
                </header>
                <section className="cards-selection" aria-label={t.card}>
                    <div>
                        <label htmlFor="cards-language">{t.language}</label>
                        <select
                            id="cards-language"
                            value={locale}
                            onChange={(event) => {
                                const next =
                                    event.target.value === 'en-US'
                                        ? 'en-US'
                                        : 'pt-BR'
                                setLocale(next)
                                saveCardLocale(next)
                            }}
                        >
                            <option value="pt-BR">Português (Brasil)</option>
                            <option value="en-US">English</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor="cards-category">{t.category}</label>
                        <select
                            id="cards-category"
                            value={category}
                            onChange={(event) =>
                                setCategory(event.target.value)
                            }
                        >
                            <option value="all">{t.all}</option>
                            {categories.map((value) => (
                                <option key={value} value={value}>
                                    {categoryNames[value] ?? value}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="cards-difficulty">{t.difficulty}</label>
                        <select
                            id="cards-difficulty"
                            value={difficulty}
                            onChange={(event) =>
                                setDifficulty(event.target.value)
                            }
                        >
                            <option value="all">{t.all}</option>
                            {difficulties.map((value) => (
                                <option key={value} value={value}>
                                    {difficultyNames[value] ?? value}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="cards-card">{t.card}</label>
                        <select
                            id="cards-card"
                            value={card?.id ?? ''}
                            disabled={!card}
                            onChange={(event) => setId(event.target.value)}
                        >
                            {!card && <option value="">—</option>}
                            {available.map((value) => (
                                <option key={value.id} value={value.id}>
                                    {value.public.word}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="cards-mode">{t.mode}</label>
                        <select
                            id="cards-mode"
                            value={mode}
                            onChange={(event) => setMode(event.target.value)}
                        >
                            <option value="local">{t.local}</option>
                            <option value="competitive">{t.competitive}</option>
                        </select>
                    </div>
                </section>
                <p>{t.movement}</p>
                {!card ? (
                    <p role="status">{t.empty}</p>
                ) : mode === 'competitive' ? (
                    <CompetitiveScreen
                        key={`${card.id}:${locale}`}
                        card={toPublicCard(card)}
                    />
                ) : (
                    <GestureScreen key={`${card.id}:${locale}`} card={card} />
                )}
            </main>
        </LocaleContext>
    )
}
