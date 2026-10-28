import { useCallback, useRef, useState } from 'react'
import { Smile } from 'lucide-react'
import { IconButton } from './Button'
import { EmojiPicker } from './EmojiPicker'
import { useOutsideClick } from '@/hooks/ui'

interface EmojiButtonProps {
  onPick: (emoji: string) => void
  label?: string
  small?: boolean
  /** Close the picker after one pick (reactions) or keep it open to add several (composers). */
  closeOnPick?: boolean
  placement?: 'top' | 'bottom'
  align?: 'start' | 'end'
}

/** Smiley button that opens the shared emoji picker in a glass popover. */
export function EmojiButton({ onPick, label = 'Add emoji', small = true, closeOnPick = false, placement = 'top', align = 'start' }: EmojiButtonProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useOutsideClick(ref, close, open)

  return (
    <div className="popover-anchor" ref={ref}>
      <IconButton label={label} small={small} active={open} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Smile size={20} />
      </IconButton>
      {open ? (
        <div className={`popover popover--${placement} ${align === 'end' ? 'popover--end' : ''}`}>
          <EmojiPicker
            onPick={(e) => {
              onPick(e)
              if (closeOnPick) setOpen(false)
            }}
          />
        </div>
      ) : null}
    </div>
  )
}
