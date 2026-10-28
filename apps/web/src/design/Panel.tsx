import { type HTMLAttributes } from 'react'

export interface PanelProps extends HTMLAttributes<HTMLElement> {
    /** Superfície um pouco mais clara, para painéis dentro de painéis. */
    raised?: boolean
}

/** Painel: superfície escura com borda fina e cantos retos. */
export function Panel({ raised = false, className, ...rest }: PanelProps) {
    const classes = ['ds-panel', raised ? 'ds-panel--raised' : null, className]
        .filter(Boolean)
        .join(' ')
    return <section className={classes} {...rest} />
}
