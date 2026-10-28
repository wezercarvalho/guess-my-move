import { type HTMLAttributes } from 'react'

/** Rótulo curto em caixa-alta, com letras espaçadas, em dourado. */
export function Eyebrow({ className, ...rest }: HTMLAttributes<HTMLParagraphElement>) {
    return <p className={['ds-eyebrow', className].filter(Boolean).join(' ')} {...rest} />
}
