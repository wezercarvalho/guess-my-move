import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const GOVERNANCE_LABEL = 'governança (SDD, docs da raiz e gates)'

// Jobs condicionais chamados pelo pr-gate, cada um com a seleção de mesmo nome em
// `detect-changes`: o job é obrigatório quando a seleção é verdadeira e pode ser pulado quando é
// falsa. Quando o scaffold da aplicação (issue #3) chegar, o job do pacote entra aqui junto com o
// padrão de path, o job no workflow e o escopo do hook local.
export const SELECTED_JOBS = ['audit']

// O job `sdd` roda as verificações do SDD, a formatação dos docs da raiz e os testes dos gates:
// é obrigatório quando qualquer das três seleções é verdadeira e pode ser pulado só quando todas
// são falsas.
export function checkJobResults(needs, selectedJobs = SELECTED_JOBS) {
    const errors = []
    const detection = needs['detect-changes']
    if (detection?.result !== 'success') return ['detect-changes deve concluir com success.']
    const selection = (name) => {
        const selected = detection.outputs?.[name]
        if (!['true', 'false'].includes(selected))
            errors.push(`${name}: seleção ausente ou inválida.`)
        return selected
    }
    const failure = (label, result, job = label) =>
        `${label}: gate obrigatório${job === label ? '' : ` (job ${job})`} falhou, foi cancelado ou ignorado indevidamente (${result ?? 'ausente'}).`
    for (const name of selectedJobs) {
        const selected = selection(name)
        const result = needs[name]?.result
        if (
            ['true', 'false'].includes(selected) &&
            (selected === 'true' ? result !== 'success' : !['success', 'skipped'].includes(result))
        )
            errors.push(failure(name, result))
    }
    const sdd = selection('sdd')
    const rootDocs = selection('root-docs')
    const tooling = selection('tooling')
    if ([sdd, rootDocs, tooling].every((selected) => ['true', 'false'].includes(selected))) {
        const required = [sdd, rootDocs, tooling].includes('true')
        const result = needs.sdd?.result
        if (required ? result !== 'success' : !['success', 'skipped'].includes(result))
            errors.push(failure(GOVERNANCE_LABEL, result, 'sdd'))
    }
    return errors
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    try {
        const errors = checkJobResults(JSON.parse(process.env.GATE_NEEDS ?? '{}'))
        for (const message of errors) console.error(message)
        if (errors.length) process.exitCode = 1
        else
            console.log(
                'Todos os gates aplicáveis passaram; os demais foram ignorados pela seleção de paths.',
            )
    } catch (error) {
        console.error(`Não foi possível verificar os gates: ${error.message}`)
        process.exitCode = 1
    }
}
