import { type HTMLAttributes } from 'react'

/** Aviso informativo (por exemplo, a nota de privacidade); anuncia-se como `note`. */
export function Notice({ className, ...rest }: HTMLAttributes<HTMLParagraphElement>) {
    return <p role="note" className={['ds-notice', className].filter(Boolean).join(' ')} {...rest} />
}
