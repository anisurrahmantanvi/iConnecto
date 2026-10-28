import type { ReactionSummary } from '@/types/db'
import { Emoji } from '@/components/ui/Emoji'
import { EmojiButton } from '@/components/ui/EmojiButton'
import { compactNumber } from '@/lib/format'

interface ReactionBarProps {
  reactions: ReactionSummary[]
  onToggle: (emoji: string, on: boolean) => void
}

/** Emoji reaction chips (always drawn with the shared emoji set) plus a picker to add one. */
export function ReactionBar({ reactions, onToggle }: ReactionBarProps) {
  return (
    <div className="reaction-bar" role="group" aria-label="Reactions">
      {reactions.map((r) => (
        <button
          key={r.emoji}
          type="button"
          className="reaction"
          aria-pressed={r.reacted}
          aria-label={`${r.emoji} ${r.count} ${r.reacted ? '(you reacted, tap to remove)' : '(tap to react)'}`}
          onClick={() => onToggle(r.emoji, !r.reacted)}
        >
          <Emoji value={r.emoji} />
          <span>{compactNumber(r.count)}</span>
        </button>
      ))}
      <EmojiButton
        label="Add reaction"
        closeOnPick
        onPick={(emoji) => {
          const existing = reactions.find((r) => r.emoji === emoji)
          if (!existing?.reacted) onToggle(emoji, true)
        }}
      />
    </div>
  )
}

/** Local (optimistic) update of the reaction list after the user toggles one emoji. */
export function applyReaction(list: ReactionSummary[], emoji: string, on: boolean): ReactionSummary[] {
  const found = list.find((r) => r.emoji === emoji)
  if (on) {
    if (found) return list.map((r) => (r.emoji === emoji ? { ...r, count: r.count + (r.reacted ? 0 : 1), reacted: true } : r))
    return [...list, { emoji, count: 1, reacted: true }]
  }
  if (!found) return list
  return list
    .map((r) => (r.emoji === emoji ? { ...r, count: Math.max(0, r.count - 1), reacted: false } : r))
    .filter((r) => r.count > 0)
}
