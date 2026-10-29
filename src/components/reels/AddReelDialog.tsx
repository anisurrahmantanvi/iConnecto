import { useState, type FormEvent } from 'react'
import type { Reel } from '@/types/db'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { TextField } from '@/components/ui/Field'
import { ErrorBanner } from '@/components/ui/Feedback'
import { errorMessage } from '@/lib/supabase'
import { addReel } from '@/services/reels'

export function AddReelDialog({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: (r: Reel) => void }) {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const reel = await addReel(url)
      setUrl('')
      onAdded(reel)
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} title="Add a TikTok video" onClose={onClose}>
      <form className="col" onSubmit={(e) => void submit(e)} noValidate>
        {error ? <ErrorBanner>{error}</ErrorBanner> : null}
        <TextField
          label="TikTok video link"
          name="tiktok-url"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="https://www.tiktok.com/@name/video/1234567890"
          hint="Open the video in a browser and copy the full address. Short links (vm.tiktok.com) do not work."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
        />
        <Button type="submit" variant="primary" block loading={busy} disabled={!url.trim()}>Add to Reels</Button>
      </form>
    </Dialog>
  )
}
