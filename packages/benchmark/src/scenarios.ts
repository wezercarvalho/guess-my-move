/**
 * Cenários do protocolo da seção 11 de
 * `docs/research/multimodal-model-selection.md` para a carta "Acenar".
 * Positivos P1–P6, negativos N1–N5.
 */
export type ScenarioLabel = 'positive' | 'negative'

export interface ScenarioDef {
    id: string
    label: ScenarioLabel
    description: string
}

export const SCENARIOS: readonly ScenarioDef[] = [
    { id: 'P1', label: 'positive', description: 'aceno com a mão direita' },
    { id: 'P2', label: 'positive', description: 'aceno com a mão esquerda' },
    { id: 'P3', label: 'positive', description: 'aceno lento' },
    { id: 'P4', label: 'positive', description: 'aceno rápido' },
    { id: 'P5', label: 'positive', description: 'aceno de perfil parcial' },
    {
        id: 'P6',
        label: 'positive',
        description: 'fundo e iluminação diferentes',
    },
    { id: 'N1', label: 'negative', description: 'pessoa parada' },
    { id: 'N2', label: 'negative', description: 'mão levantada sem acenar' },
    { id: 'N3', label: 'negative', description: 'coçando a cabeça' },
    {
        id: 'N4',
        label: 'negative',
        description: 'movendo os dois braços aleatoriamente',
    },
    { id: 'N5', label: 'negative', description: 'sem pessoa no quadro' },
]

const SCENARIO_BY_ID = new Map(SCENARIOS.map((s) => [s.id, s]))

export function scenarioById(id: string): ScenarioDef | undefined {
    return SCENARIO_BY_ID.get(id)
}

/**
 * Um clipe do manifesto: um cenário, o rótulo esperado e os arquivos de frame
 * (relativos ao diretório do manifesto, em ordem cronológica).
 */
export interface ClipEntry {
    id: string
    scenario: string
    expected: ScenarioLabel
    frames: string[]
    /** Variante opcional (ex.: "6f-640x480") para agrupar resultados. */
    variant?: string
}

/** Formato do manifesto JSON lido de um diretório local fora do Git. */
export interface BenchmarkManifest {
    /** Versão do formato, para evolução futura. */
    version: 1
    /** Metadados declarados da amostra (pessoas, ambientes, iluminação). */
    sample?: {
        people?: number
        environments?: number
        lightingConditions?: number
        notes?: string
    }
    clips: ClipEntry[]
}
