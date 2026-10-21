import { relative, sep } from 'node:path'

export function isWithin(root, file) {
    const path = relative(root, file)
    return (
        path !== '..' &&
        !path.startsWith('..' + sep) &&
        !path.startsWith(sep) &&
        !/^[A-Z]:/i.test(path)
    )
}

export function isDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
    const [year, month, day] = value.split('-').map(Number)
    const date = new Date(0)
    date.setUTCFullYear(year, month - 1, day)
    return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
    )
}
export function withoutFences(text) {
    let fence
    return text
        .split('\n')
        .map((line) => {
            const mark = line.match(/^\s{0,3}(`{3,}|~{3,})/)
            if (mark && !fence) {
                fence = mark[1]
                return ''
            }
            if (fence) {
                if (mark && mark[1][0] === fence[0] && mark[1].length >= fence.length)
                    fence = undefined
                return ''
            }
            return line
        })
        .join('\n')
}
