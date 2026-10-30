import { useId, useState, type InputHTMLAttributes } from 'react'

interface SuggestFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  label: string
  value: string
  onChange: (value: string) => void
  /** Returns up to a few suggestions for what has been typed so far. */
  suggest: (query: string) => string[]
  hint?: string
}

/** A text box with a list of suggestions under it. Free text is always allowed; tapping a suggestion fills it in. */
export function SuggestField({ label, value, onChange, suggest, hint, id, ...rest }: SuggestFieldProps) {
  const auto = useId()
  const fid = id ?? auto
  const [open, setOpen] = useState(false)
  const options = open ? suggest(value).filter((o) => o !== value) : []

  return (
    <div className="field suggest">
      <label htmlFor={fid}>{label}</label>
      <input
        {...rest}
        id={fid}
        className="input"
        value={value}
        autoComplete="off"
        role="combobox"
        aria-expanded={options.length > 0}
        aria-controls={`${fid}-list`}
        aria-autocomplete="list"
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
      />
      {options.length ? (
        <ul id={`${fid}-list`} className="glass glass--strong suggest__list" role="listbox">
          {options.map((o) => (
            <li key={o} role="option" aria-selected={false}>
              <button
                type="button"
                className="suggest__item"
                // pointer-down fires before the input loses focus, so the tap is never swallowed on phones
                onPointerDown={(e) => {
                  e.preventDefault()
                  onChange(o)
                  setOpen(false)
                }}
              >
                {o}
              </button>
            </li>
          ))}
        </ul>
      ) : hint ? (
        <span className="field-hint">{hint}</span>
      ) : null}
    </div>
  )
}
