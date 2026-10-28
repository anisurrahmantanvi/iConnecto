import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { IconButton } from './Button'

interface DialogProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

export function Dialog({ open, title, onClose, children }: DialogProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      previous?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className="glass glass--strong dialog" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
        <div className="row" style={{ marginBottom: 12 }}>
          <h2 className="grow">{title}</h2>
          <IconButton label="Close" small onClick={onClose}><X size={20} /></IconButton>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
