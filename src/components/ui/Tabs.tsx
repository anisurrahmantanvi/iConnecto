import type { KeyboardEvent } from 'react'

interface TabsProps<T extends string> {
  value: T
  onChange: (value: T) => void
  tabs: { value: T; label: string }[]
  label: string
}

/** Segmented glass tabs with arrow-key navigation. The caller renders the matching panel. */
export function Tabs<T extends string>({ value, onChange, tabs, label }: TabsProps<T>) {
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    const i = tabs.findIndex((t) => t.value === value)
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length]
    onChange(next.value)
    e.preventDefault()
    window.requestAnimationFrame(() => {
      e.currentTarget.querySelector<HTMLElement>('[aria-selected="true"]')?.focus()
    })
  }
  return (
    <div className="glass tabs" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          className="tab"
          aria-selected={t.value === value}
          tabIndex={t.value === value ? 0 : -1}
          onClick={() => onChange(t.value)}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
