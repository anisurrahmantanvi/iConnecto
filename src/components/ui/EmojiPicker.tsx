import { EMOJI_PICKER_SET } from '@/lib/emoji'
import { Emoji } from './Emoji'

export function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  return (
    <div className="glass emoji-picker" role="listbox" aria-label="Emoji picker">
      {EMOJI_PICKER_SET.map((e) => (
        <button key={e} type="button" role="option" aria-selected="false" aria-label={e} onClick={() => onPick(e)}>
          <Emoji value={e} />
        </button>
      ))}
    </div>
  )
}
