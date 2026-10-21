/**
 * Aviso visível de que os frames capturados são enviados a um provedor externo
 * para gerar o palpite (FR-011). O texto é curto, claro e permanente na tela
 * antes de qualquer captura.
 */
export function ExternalProviderNotice() {
    return (
        <p className="external-provider-notice" role="note">
            <strong>Privacidade:</strong> ao capturar e adivinhar, alguns frames
            da sua câmera são enviados a um provedor de IA externo para gerar o
            palpite. Os frames são usados só para essa tentativa e não são
            armazenados.
        </p>
    )
}
