import { Notice } from '../design/index.js'

/** Aviso único de privacidade, igual em todas as telas. */
export function PrivacyNotice() {
    return (
        <Notice>
            <strong>Privacidade:</strong> a câmera é processada no navegador. Nada é enviado nem
            gravado.
        </Notice>
    )
}
