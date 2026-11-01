import { Copy, Forward, Pencil, Undo2 } from 'lucide-react'
import type { Message } from '@/types/db'
import { Dialog } from '@/components/ui/Dialog'

export const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏']

interface Props {
  message: Message | null
  mine: boolean
  /** True while the 2-minute edit / unsend window is open. */
  canChange: boolean
  myReaction: string | null
  onClose: () => void
  onReact: (emoji: string | null) => void
  onCopy: () => void
  onForward: () => void
  onEdit: () => void
  onUnsend: () => void
}

/** What you can do with one message: react, copy, forward, and (mine, within 2 minutes) edit or unsend. */
export function MessageSheet({ message, mine, canChange, myReaction, onClose, onReact, onCopy, onForward, onEdit, onUnsend }: Props) {
  const pick = (fn: () => void) => () => {
    onClose()
    fn()
  }
  return (
    <Dialog open={message !== null} title="Message" onClose={onClose}>
      <div className="reaction-pick" role="group" aria-label="React">
        {QUICK_REACTIONS.map((e) => (
          <button
            key={e}
            type="button"
            className="reaction-pick__btn"
            aria-pressed={myReaction === e}
            aria-label={`React ${e}`}
            onClick={pick(() => onReact(myReaction === e ? null : e))}
          >
            {e}
          </button>
        ))}
      </div>
      <div className="menu" style={{ boxShadow: 'none', background: 'transparent' }}>
        <button type="button" className="menu__item" onClick={pick(onCopy)}><Copy size={18} /> Copy</button>
        <button type="button" className="menu__item" onClick={pick(onForward)}><Forward size={18} /> Forward</button>
        {mine && canChange ? <button type="button" className="menu__item" onClick={pick(onEdit)}><Pencil size={18} /> Edit</button> : null}
        {mine && canChange ? <button type="button" className="menu__item menu__item--danger" onClick={pick(onUnsend)}><Undo2 size={18} /> Unsend</button> : null}
      </div>
      {mine && !canChange ? <p className="small muted" style={{ marginTop: 8 }}>You can edit or unsend a message only within 2 minutes of sending it.</p> : null}
    </Dialog>
  )
}
