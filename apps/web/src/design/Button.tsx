import { type ButtonHTMLAttributes } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'text'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    /** `primary`: dourado cheio; `secondary`: contorno; `text`: só texto dourado. */
    variant?: ButtonVariant
}

/** Botão do design system; o tipo padrão é `button` (nunca envia formulário sem querer). */
export function Button({ variant = 'primary', className, type = 'button', ...rest }: ButtonProps) {
    const classes = ['ds-button', `ds-button--${variant}`, className].filter(Boolean).join(' ')
    return <button type={type} className={classes} {...rest} />
}
