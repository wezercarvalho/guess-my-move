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
    return resolveCityMap(catalog, new URL(window.location.href).searchParams.get('city'))
}

function setCityInUrl(id: string | null): void {
    const url = new URL(window.location.href)
    if (id) url.searchParams.set('city', id)
    else url.searchParams.delete('city')
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
}

/** Porta do Arranha-Teia: catálogo/seleção primeiro; só então monta câmera, WebGL e jogo. */
export function SwingApp({
    loadCatalog = loadDefaultCatalog,
    deps,
}: SwingAppProps) {
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
    if (!selected) return <CitySelect catalog={catalog} onSelect={select} />
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
