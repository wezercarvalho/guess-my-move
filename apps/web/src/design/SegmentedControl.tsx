export interface SegmentedOption<T extends string> {
    value: T
    label: string
}

export interface SegmentedControlProps<T extends string> {
    /** Legenda do grupo (nome acessível do `fieldset`). */
    legend: string
    /** Nome compartilhado pelos botões de rádio. */
    name: string
    value: T
    options: readonly SegmentedOption<T>[]
    onChange: (value: T) => void
}

/** Controle segmentado acessível: um grupo de botões de rádio nativos, operável por teclado. */
export function SegmentedControl<T extends string>({
    legend,
    name,
    value,
    options,
    onChange,
}: SegmentedControlProps<T>) {
    return (
        <fieldset className="ds-segmented">
            <legend>{legend}</legend>
            <div className="ds-segmented-options">
                {options.map((option) => (
                    <label key={option.value} className="ds-segment">
                        <input
                            type="radio"
                            name={name}
                            checked={value === option.value}
                            onChange={() => {
                                onChange(option.value)
                            }}
                        />
                        {option.label}
                    </label>
                ))}
            </div>
        </fieldset>
    )
}
