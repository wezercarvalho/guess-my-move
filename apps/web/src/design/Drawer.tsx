import { type ReactNode } from 'react'

import { Button } from './Button.js'

export interface DrawerToggleProps {
    open: boolean
    panelId: string
    onToggle: () => void
    children: ReactNode
}

/** Botão da gaveta: anuncia o estado por `aria-expanded` e aponta o painel por `aria-controls`. */
export function DrawerToggle({ open, panelId, onToggle, children }: DrawerToggleProps) {
    return (
        <Button variant="secondary" aria-expanded={open} aria-controls={panelId} onClick={onToggle}>
            {children}
        </Button>
    )
}

export interface DrawerPanelProps {
    open: boolean
    panelId: string
    children: ReactNode
}

/** Conteúdo da gaveta: recolhido por padrão e fora da árvore de acessibilidade enquanto fechado. */
export function DrawerPanel({ open, panelId, children }: DrawerPanelProps) {
    return (
        <div id={panelId} className="ds-drawer" hidden={!open}>
            {children}
        </div>
    )
}
