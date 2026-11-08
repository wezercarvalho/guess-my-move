import { useEffect, useRef, useState } from 'react'

import { type FeedbackInput, deriveChips, feedbackEvents } from './feedback.js'

/** Quanto cada aviso de evento fica na tela, em ms (valor de jogo). */
export const TOAST_MS = 1600
/** No máximo este tanto de avisos ao mesmo tempo; os mais antigos saem primeiro. */
const MAX_TOASTS = 3

interface Toast {
    id: number
    text: string
}

/**
 * Mensagens sobre o jogo, na base do palco (CSS: centralizadas na horizontal, nunca no centro
 * da visão, sem pegar o mouse). Os estados que duram (`deriveChips`) ficam enquanto valem; os
 * avisos de evento (`feedbackEvents`) somem sozinhos depois de `TOAST_MS`.
 */
export function SwingFeedback({ input }: { input: FeedbackInput }) {
    const [toasts, setToasts] = useState<Toast[]>([])
    const previous = useRef<FeedbackInput | null>(null)
    const nextId = useRef(0)
    const timers = useRef(new Set<ReturnType<typeof setTimeout>>())

    useEffect(() => {
        const events = feedbackEvents(previous.current, input)
        previous.current = input
        if (events.length === 0) return
        const added = events.map((text) => ({ id: nextId.current++, text }))
        setToasts((current) => [...current, ...added].slice(-MAX_TOASTS))
        for (const toast of added) {
            const timer = setTimeout(() => {
                timers.current.delete(timer)
                setToasts((current) => current.filter((item) => item.id !== toast.id))
            }, TOAST_MS)
            timers.current.add(timer)
        }
    }, [input])

    useEffect(() => {
        const pending = timers.current
        return () => {
            for (const timer of pending) clearTimeout(timer)
            pending.clear()
        }
    }, [])

    const chips = deriveChips(input)
    const visible = input.phase === 'playing' ? toasts : []

    return (
        <div className="swing-feedback" aria-live="polite" data-testid="swing-feedback">
            {visible.length > 0 && (
                <ul className="swing-feedback__toasts">
                    {visible.map((toast) => (
                        <li key={toast.id} className="swing-toast">
                            {toast.text}
                        </li>
                    ))}
                </ul>
            )}
            {chips.length > 0 && (
                <ul className="swing-feedback__chips">
                    {chips.map((chip) => (
                        <li key={chip.id} className="swing-chip" data-tone={chip.tone} data-chip={chip.id}>
                            <span>{chip.text}</span>
                            {chip.progress !== undefined && (
                                <span
                                    className="swing-chip__bar"
                                    role="progressbar"
                                    aria-label="Espera para escalar"
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                    aria-valuenow={Math.round(chip.progress * 100)}
                                >
                                    <span style={{ width: `${Math.round(chip.progress * 100)}%` }} />
                                </span>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}
