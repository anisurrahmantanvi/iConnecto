import { memo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { emojiUrl, isEmojiOnly, splitEmoji } from '@/lib/emoji'

/** One emoji, always drawn from the shared image set. Falls back to the native glyph if the image fails to load. */
export const Emoji = memo(function Emoji({ value }: { value: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return <span>{value}</span>
  return (
    <img
      className="emoji"
      src={emojiUrl(value)}
      alt={value}
      draggable={false}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  )
})

const TOKEN_RE = /(@[A-Za-z0-9_]{3,20}|https?:\/\/[^\s<]+)/g

function renderEmojiText(text: string, keyPrefix: string): ReactNode[] {
  return splitEmoji(text).map((seg, i) =>
    seg.type === 'emoji' ? <Emoji key={`${keyPrefix}-${i}`} value={seg.value} /> : <span key={`${keyPrefix}-${i}`}>{seg.value}</span>,
  )
}

/**
 * Renders user text with consistent emoji, clickable @mentions and safe links.
 * Never uses dangerouslySetInnerHTML; all output is React text nodes.
 */
export const RichText = memo(function RichText({ text, className, jumbo = false }: { text: string; className?: string; jumbo?: boolean }) {
  const parts = text.split(TOKEN_RE)
  // Messages made of 1-3 emoji and nothing else are shown larger (chat apps do the same).
  const big = jumbo && isEmojiOnly(text, 3)
  return (
    <span className={`pre-wrap ${big ? 'rich--jumbo' : ''} ${className ?? ''}`}>
      {parts.map((part, i) => {
        if (!part) return null
        if (part.startsWith('@') && /^@[A-Za-z0-9_]{3,20}$/.test(part)) {
          return (
            <Link key={i} to={`/u/${part.slice(1)}`}>
              {part}
            </Link>
          )
        }
        if (/^https?:\/\//.test(part)) {
          return (
            <a key={i} href={part} target="_blank" rel="noopener noreferrer nofollow">
              {part}
            </a>
          )
        }
        return <span key={i}>{renderEmojiText(part, String(i))}</span>
      })}
    </span>
  )
})
