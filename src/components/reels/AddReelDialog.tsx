import { useState, type FormEvent } from 'react'
import type { Reel } from '@/types/db'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { TextAreaField } from '@/components/ui/Field'
import { ErrorBanner } from '@/components/ui/Feedback'
import { errorMessage } from '@/lib/supabase'
import { addReel } from '@/services/reels'

const MAX_LINKS = 30

/** Pulls every web address out of pasted text (one per line, or mixed with other words). */
function extractLinks(text: string): string[] {
  const found = text.match(/https?:\/\/[^\s<>"']+/gi) ?? []
  return [...new Set(found)]
}

export function AddReelDialog({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: (r: Reel) => void }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<string | null>(null)

  const links = extractLinks(text)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setReport(null)
    if (!links.length) return setError('Paste at least one TikTok video link.')
    if (links.length > MAX_LINKS) return setError(`Add up to ${MAX_LINKS} links at a time.`)
    setBusy(true)
    let added = 0
    const duplicates: string[] = []
    const failed: string[] = []
    const remaining: string[] = []
    for (const link of links) {
      try {
        onAdded(await addReel(link))
        added += 1
      } catch (err) {
        const msg = errorMessage(err)
        if (/already in reels/i.test(msg)) duplicates.push(link)
        else {
          failed.push(`${link} — ${msg}`)
          remaining.push(link)
        }
      }
    }
    setBusy(false)
    // Keep only the links that failed, so they can be fixed and sent again.
    setText(remaining.join('\n'))
    const parts = [`${added} added`]
    if (duplicates.length) parts.push(`${duplicates.length} already in Reels`)
    if (failed.length) parts.push(`${failed.length} could not be added`)
    setReport(parts.join(', ') + '.')
    if (failed.length) setError(failed.slice(0, 3).join('\n') + (failed.length > 3 ? `\n…and ${failed.length - 3} more` : ''))
    else if (added > 0 || duplicates.length) window.setTimeout(onClose, 900)
  }

  return (
    <Dialog open={open} title="Add TikTok videos" onClose={onClose}>
      <form className="col" onSubmit={(e) => void submit(e)} noValidate>
        {error ? <ErrorBanner><span className="pre-wrap">{error}</span></ErrorBanner> : null}
        {report ? <p className="small" role="status">{report}</p> : null}
        <TextAreaField
          label="TikTok video links"
          name="tiktok-links"
          rows={6}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder={'https://www.tiktok.com/@name/video/1234567890\nhttps://www.tiktok.com/@other/video/9876543210'}
          hint={`One link per line, up to ${MAX_LINKS} at once. Use the full address (tiktok.com/@name/video/123…); short vm.tiktok.com links do not work.`}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <Button type="submit" variant="primary" block loading={busy} disabled={!links.length}>
          {links.length > 1 ? `Add ${links.length} videos` : 'Add to Reels'}
        </Button>
      </form>
    </Dialog>
  )
}
