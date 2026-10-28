import { env } from './env'

/**
 * Consistent emoji: every emoji in posts, comments, chats and reactions is rendered as the same
 * SVG image set (Twemoji by default) instead of the device font, so Android, iOS and desktop look identical.
 * The original character stays in the DOM as the <img alt>, so copy/paste and screen readers still work.
 *
 * Escapes are used on purpose (U+FE0F variation selector, U+200D zero-width joiner, U+20E3 keycap) because
 * those characters are invisible in editors and easy to delete by accident.
 */
const VS16 = '\\uFE0F'
const ZWJ = '\\u200D'
const KEYCAP = '\\u20E3'
// A pictographic code point, optionally followed by VS16 or a skin-tone modifier.
// (c) (r) (tm) are only treated as emoji when explicitly followed by VS16, so "(c) 2026" stays text.
const PICTO = `(?:(?![\\u00A9\\u00AE\\u2122](?!${VS16}))\\p{Extended_Pictographic})(?:${VS16}|\\p{Emoji_Modifier})?`

export const EMOJI_SOURCE =
  `(?:\\p{Regional_Indicator}{2}|[#*0-9]${VS16}?${KEYCAP}|${PICTO}(?:${ZWJ}${PICTO})*)`

export type EmojiSegment = { type: 'text'; value: string } | { type: 'emoji'; value: string }

export function splitEmoji(text: string): EmojiSegment[] {
  const re = new RegExp(EMOJI_SOURCE, 'gu')
  const out: EmojiSegment[] = []
  let last = 0
  for (const m of text.matchAll(re)) {
    const idx = m.index ?? 0
    if (idx > last) out.push({ type: 'text', value: text.slice(last, idx) })
    out.push({ type: 'emoji', value: m[0] })
    last = idx + m[0].length
  }
  if (last < text.length) out.push({ type: 'text', value: text.slice(last) })
  return out
}

/** True when the text contains only emoji (and whitespace), at most `max` of them: used to render "jumbo" emoji. */
export function isEmojiOnly(text: string, max = 3): boolean {
  const segs = splitEmoji(text.trim())
  if (!segs.length) return false
  let count = 0
  for (const s of segs) {
    if (s.type === 'text') {
      if (s.value.trim() !== '') return false
    } else count++
  }
  return count > 0 && count <= max
}

/** Twemoji file naming: lowercase hex code points joined by "-", with VS16 dropped unless the emoji is a ZWJ sequence. */
export function emojiToCodepoints(emoji: string): string {
  const raw = emoji.includes('‍') ? emoji : emoji.replace(/️/g, '')
  return Array.from(raw)
    .map((c) => (c.codePointAt(0) ?? 0).toString(16))
    .join('-')
}

export function emojiUrl(emoji: string, base: string = env.emojiBaseUrl): string {
  const b = base.endsWith('/') ? base : base + '/'
  return `${b}${emojiToCodepoints(emoji)}.svg`
}

export const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥']

export const EMOJI_PICKER_SET = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😍', '🥰', '😘', '😋',
  '😎', '🤩', '🥳', '😏', '😌', '🤔', '🤗', '🫡', '😴', '😮', '😢', '😭', '😤', '😡', '🥺', '😱',
  '👍', '👎', '👏', '🙌', '🙏', '💪', '👋', '🤝', '✌️', '🤞', '👌', '🫶', '❤️', '🧡', '💛', '💚',
  '💙', '💜', '🖤', '💔', '🔥', '✨', '🎉', '🎂', '🌹', '🌈', '☀️', '🌙', '⭐', '💯', '✅', '❌',
  '📸', '🎵', '🎮', '⚽', '🏏', '☕', '🍕', '🍔', '🍰', '🌴', '🚀', '💡', '📌', '🎁', '🐱', '🐶',
]
