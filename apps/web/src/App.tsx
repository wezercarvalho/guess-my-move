import { CameraPanel } from './camera/CameraPanel.js'
import { useCamera } from './camera/useCamera.js'
import './styles.css'

export function App() {
    const camera = useCamera()

    return (
        <main className="app">
            <header className="app-header">
                <h1>Guess My Move</h1>
                <p>
                    PoC visual: ative a câmera para preparar a captura do gesto.
                    A captura e o adivinhador chegam nas próximas entregas.
                </p>
            </header>

            <CameraPanel camera={camera} />
        </main>
    )
}
