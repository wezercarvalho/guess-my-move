import { useId, useState } from 'react'

/** Estado e atributos de uma gaveta: o botão e o painel podem ficar em lugares diferentes da tela. */
export function useDrawer() {
    const panelId = useId()
    const [open, setOpen] = useState(false)
    return {
        open,
        panelId,
        toggle: () => {
            setOpen((value) => !value)
        },
    }
}
