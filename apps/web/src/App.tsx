import { CameraPanel } from './camera/CameraPanel.js'
import { useCamera } from './camera/useCamera.js'
import { ExternalProviderNotice } from './capture/ExternalProviderNotice.js'
import './styles.css'

export function App() {
    const camera = useCamera()

    return (
        <main className="app">
            <header className="app-header">
                <h1>Guess My Move</h1>
                <p>
                    PoC visual: ative a câmera para preparar a captura do gesto.
                    O adivinhador chega na próxima entrega.
                </p>
            </header>

            <ExternalProviderNotice />
            <CameraPanel camera={camera} />
        </main>
    )
}
