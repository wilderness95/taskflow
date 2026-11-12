type FilterOption<T extends string> = { value: T; label: string }

type FilterGroupProps<T extends string> = {
  legend: string
  options: FilterOption<T>[]
  selected: T[]
  onChange: (selected: T[]) => void
}

/** Jelölőnégyzetek egy szűrőcsoporthoz (a kiválasztott értékek között VAGY kapcsolat van). */
export function FilterGroup<T extends string>({
  legend,
  options,
  selected,
  onChange,
}: FilterGroupProps<T>) {
  const toggle = (value: T) =>
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value])

  return (
    <fieldset className="filter-group">
      <legend>{legend}</legend>
      {options.map((option) => (
        <label key={option.value} className="filter-option">
          <input
            type="checkbox"
            checked={selected.includes(option.value)}
            onChange={() => toggle(option.value)}
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  )
}
