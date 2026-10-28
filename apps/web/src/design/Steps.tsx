export interface StepsProps {
    /** Nome acessível da lista. */
    label: string
    items: readonly string[]
    /** Etapa atual (1 a N) ou `null` quando nenhuma está em andamento. */
    current: number | null
}

/** Lista ordenada de etapas; a atual é marcada com `aria-current="step"`. */
export function Steps({ label, items, current }: StepsProps) {
    return (
        <ol className="ds-steps" aria-label={label}>
            {items.map((text, index) => (
                <li
                    key={text}
                    className="ds-step"
                    {...(current === index + 1 ? { 'aria-current': 'step' as const } : {})}
                >
                    <span>{text}</span>
                </li>
            ))}
        </ol>
    )
}
