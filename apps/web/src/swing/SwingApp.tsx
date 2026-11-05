import { TRAINING_MAP } from './training.js'
import { useCallback, useEffect, useState } from 'react'

import { Button, Panel } from '../design/index.js'
import { CitySelect } from './CitySelect.js'
import {
    type CityCatalog,
    type CityMap,
    fetchCityCatalog,
    resolveCityMap,
} from './cityCatalog.js'
import { SwingScreen } from './SwingScreen.js'
import { type SwingDeps } from './useSwingGame.js'

export interface SwingAppProps {
    /** Injetável para testes; por padrão lê o catálogo da própria origem. */
    loadCatalog?: () => Promise<CityCatalog>
    deps?: SwingDeps
}

const loadDefaultCatalog = () => fetchCityCatalog(`${import.meta.env.BASE_URL}swing/cities.json`)

function cityFromUrl(catalog: CityCatalog): CityMap | null {
    const params = new URL(window.location.href).searchParams
    return params.get('mode') === 'training' ? TRAINING_MAP : resolveCityMap(catalog, params.get('city'))
}

function setCityInUrl(id: string | null): void {
    const url = new URL(window.location.href)
    url.searchParams.delete('mode')
    url.searchParams.delete('city')
    if (id === TRAINING_MAP.id) url.searchParams.set('mode', 'training')
    else if (id) url.searchParams.set('city', id)
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
}

/** Porta do Arranha-Teia: catálogo/seleção primeiro; só então monta câmera, WebGL e jogo. */
export function SwingApp({
    loadCatalog = loadDefaultCatalog,
    deps,
}: SwingAppProps) {
    const [traveler, setTraveler] = useState(false)
    const [attempt, setAttempt] = useState(0)
    const [catalog, setCatalog] = useState<CityCatalog | null>(null)
    const [selected, setSelected] = useState<CityMap | null>(null)
    const [failure, setFailure] = useState<string | null>(null)

    useEffect(() => {
        let active = true
        loadCatalog().then(
            (loaded) => {
                if (!active) return
                setCatalog(loaded)
                setSelected(cityFromUrl(loaded))
            },
            () => {
                if (active) setFailure('Não foi possível carregar os mapas.')
            },
        )
        return () => {
            active = false
        }
    }, [loadCatalog, attempt])

    const select = useCallback((map: CityMap) => {
        setCityInUrl(map.id)
        setSelected(map)
    }, [])

    const change = useCallback(() => {
        const wasTraining = new URL(window.location.href).searchParams.get('mode') === 'training'
        setTraveler(!wasTraining)
        setCityInUrl(null)
        setSelected(null)
    }, [])

    const retry = useCallback(() => {
        setCatalog(null)
        setFailure(null)
        setAttempt((value) => value + 1)
    }, [])

    if (failure) {
        return (
            <main className="app app-wide swing-map-state">
                <Panel raised>
                    <p role="alert">{failure}</p>
                    <Button onClick={retry}>Tentar novamente</Button>
                </Panel>
            </main>
        )
    }
    if (!catalog) {
        return (
            <main className="app app-wide swing-map-state" aria-busy="true">
                <Panel raised>
                    <p>Carregando mapas…</p>
                </Panel>
            </main>
        )
    }
    if (!selected && !traveler) return (
        <main className="app app-wide swing-map-select" aria-labelledby="mode-select-title">
            <header className="swing-map-select__header"><h1 id="mode-select-title">Escolha o modo</h1><p>Arranha-Teia · explore no seu ritmo.</p></header>
            <div className="swing-map-grid">
                <Panel raised><h2>Treino</h2><p>Aprenda os comandos em Aurora, uma cidade futurista de néon. Sem tempo nem pontuação.</p><Button onClick={() => select(TRAINING_MAP)}>Treino</Button></Panel>
                <Panel raised><h2>Viajante</h2><p>Escolha uma cidade real e admire a vista entre as teias.</p><Button onClick={() => setTraveler(true)}>Viajante</Button></Panel>
            </div>
            <a className="swing-map-back" href="./">Voltar aos jogos</a>
        </main>
    )
    if (!selected) return <><CitySelect catalog={catalog} onSelect={select} /><Button variant="text" onClick={() => setTraveler(false)}>Trocar modo</Button></>
    return (
        <main className="app app-wide app-fill">
            <SwingScreen
                key={selected.id}
                map={selected}
                onChangeMap={change}
                {...(deps === undefined ? {} : { deps })}
            />
        </main>
    )
}
