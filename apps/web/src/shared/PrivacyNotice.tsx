import { useI18n } from '../i18n/locale.js'
import { Notice } from '../design/index.js'

/** Aviso único de privacidade, igual em todas as telas. */
export function PrivacyNotice() {
    const { t } = useI18n()
    return (
        <Notice>
            <strong>{t.privacyTitle}</strong> {t.privacy}
        </Notice>
    )
}
