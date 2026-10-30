export interface SuggestEntry {
  en: string
  bn: string
  /** Extra words that should also match (abbreviations, old names). */
  alt?: string
}

const norm = (s: string) => s.toLowerCase().replace(/[(),.]/g, ' ').replace(/\s+/g, ' ').trim()
const hasBengali = (s: string) => /[ঀ-৿]/.test(s)

/**
 * Finds entries that contain every typed word (English or Bengali). Typing Bengali inserts the Bengali name, anything else the
 * English one. Entries whose name starts with what was typed come first.
 */
export function searchSuggestions(entries: readonly SuggestEntry[], query: string, limit = 6): string[] {
  const q = norm(query)
  if (q.length < 2) return []
  const words = q.split(' ')
  const bengali = hasBengali(query)
  const scored: { text: string; score: number }[] = []
  for (const e of entries) {
    const text = bengali ? e.bn : e.en
    const hay = norm(`${e.en} ${e.bn} ${e.alt ?? ''}`)
    if (!words.every((w) => hay.includes(w))) continue
    const name = norm(text)
    const score = name === q ? 0 : name.startsWith(q) ? 1 : name.split(' ').some((p) => p.startsWith(words[0])) ? 2 : 3
    scored.push({ text, score })
  }
  scored.sort((a, b) => a.score - b.score || a.text.length - b.text.length)
  return scored.slice(0, limit).map((s) => s.text)
}
