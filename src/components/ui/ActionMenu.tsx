import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { IconButton } from './Button'
import { useOutsideClick } from '@/hooks/ui'

export interface MenuItem {
  label: string
  icon?: ReactNode
  onSelect: () => void
  danger?: boolean
  hidden?: boolean
}

/** A "more" button that opens a small glass menu. Closes on outside click, Escape and after choosing an item. */
export function ActionMenu({ items, label = 'More actions', icon }: { items: MenuItem[]; label?: string; icon?: ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useOutsideClick(ref, close, open)

  useEffect(() => {
    if (open) ref.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
  }, [open])

  const visible = items.filter((i) => !i.hidden)
  if (!visible.length) return null

  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    const els = Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
    const i = els.indexOf(document.activeElement as HTMLElement)
    const next = e.key === 'ArrowDown' ? (i + 1) % els.length : (i - 1 + els.length) % els.length
    els[next]?.focus()
    e.preventDefault()
  }

  return (
    <div className="popover-anchor" ref={ref} onKeyDown={onKeyDown}>
      <IconButton label={label} small aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {icon ?? <MoreHorizontal size={20} />}
      </IconButton>
      {open ? (
        <div className="glass glass--strong menu popover popover--bottom popover--end" role="menu">
          {visible.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={`menu__item ${item.danger ? 'menu__item--danger' : ''}`}
              onClick={() => {
                setOpen(false)
                item.onSelect()
              }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
