import { Button, Eyebrow, Panel } from '../design/index.js'
import { type CityCatalog, type CityMap } from './cityCatalog.js'

interface CitySelectProps {
    catalog: CityCatalog
    onSelect: (map: CityMap) => void
}

/** Seleção de mapa antes da partida; ainda não cria câmera, detector, física ou WebGL. */
export function CitySelect({ catalog, onSelect }: CitySelectProps) {
    return (
        <main className="app app-wide swing-map-select" aria-labelledby="map-select-title">
            <header className="swing-map-select__header">
                <Eyebrow>Arranha-Teia</Eyebrow>
                <h1 id="map-select-title">Escolha o mapa</h1>
                <p>Onde você quer balançar?</p>
            </header>
            <div className="swing-map-grid">
                {catalog.maps.map((map) => (
                    <Panel raised className="swing-map-card" key={map.id}>
                        <div className="swing-map-card__skyline" aria-hidden="true" data-map={map.id}>
                            <span />
                            <span />
                            <span />
                            <span />
                            <span />
                        </div>
                        <div className="swing-map-card__title">
                            <div>
                                <h2>{map.name}</h2>
                                <p className="swing-map-region">{map.region}</p>
                            </div>
                            {map.recommended ? <span className="swing-map-badge">Recomendado</span> : null}
                        </div>
                        <p>{map.description}</p>
                        <Button onClick={() => onSelect(map)}>Viajar pela {map.name}</Button>
                    </Panel>
                ))}
            </div>
            <a className="swing-map-back" href="./">
                Voltar aos jogos
            </a>
        </main>
    )
}
