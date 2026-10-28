import { Search, X } from 'lucide-react'
import { IconButton } from './Button'

interface SearchBoxProps {
  value: string
  onChange: (value: string) => void
  label: string
  placeholder?: string
  autoFocus?: boolean
}

export function SearchBox({ value, onChange, label, placeholder, autoFocus }: SearchBoxProps) {
  return (
    <div className="glass search-box" role="search">
      <Search size={18} aria-hidden />
      <input
        type="search"
        className="search-box__input"
        aria-label={label}
        placeholder={placeholder ?? label}
        value={value}
        autoFocus={autoFocus}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={50}
        onChange={(e) => onChange(e.target.value)}
      />
      {value ? (
        <IconButton label="Clear search" small onClick={() => onChange('')}>
          <X size={16} />
        </IconButton>
      ) : null}
    </div>
  )
}
