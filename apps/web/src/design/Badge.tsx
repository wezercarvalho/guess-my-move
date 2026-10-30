import { type HTMLAttributes } from 'react'

/** Selo curto (por exemplo, "Alpha") para marcar um item em teste. O texto é lido por leitor de tela. */
export function Badge({ className, ...rest }: HTMLAttributes<HTMLSpanElement>) {
    const classes = ['ds-badge', className].filter(Boolean).join(' ')
    return <span className={classes} {...rest} />
}
