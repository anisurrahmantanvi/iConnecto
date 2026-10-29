import { useRef, useState } from 'react'
import { Camera, Loader2, Trash2 } from 'lucide-react'
import type { Profile } from '@/types/db'
import { useToast } from '@/components/ui/Toast'
import { changeCover } from '@/services/profiles'
import { errorMessage } from '@/lib/supabase'

interface CoverUploaderProps {
  profile: Profile
  onUpdated: (profile: Profile) => void
}

/** Edit-profile control: tap the banner to choose a cover photo; a small button removes it. */
export function CoverUploader({ profile, onUpdated }: CoverUploaderProps) {
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const run = async (file: File | null) => {
    setBusy(true)
    try {
      onUpdated(await changeCover(profile.id, file, profile.cover_url))
      toast.show(file ? 'Cover photo updated' : 'Cover photo removed')
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div className="cover-edit">
      <button type="button" className="cover-edit__btn" aria-label="Change cover photo" disabled={busy} onClick={() => input.current?.click()}>
        {profile.cover_url ? <img src={profile.cover_url} alt="" /> : null}
        <span className="cover-edit__hint">
          {busy ? <Loader2 size={16} className="spin" aria-hidden /> : <Camera size={16} aria-hidden />}
          {profile.cover_url ? 'Change cover photo' : 'Add cover photo'}
        </span>
      </button>
      {profile.cover_url ? (
        <button type="button" className="cover-edit__remove" aria-label="Remove cover photo" disabled={busy} onClick={() => void run(null)}>
          <Trash2 size={16} aria-hidden />
        </button>
      ) : null}
      <input
        ref={input}
        className="file-hidden"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void run(f) }}
      />
    </div>
  )
}
