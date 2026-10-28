import { useRef, useState } from 'react'
import { Camera, Loader2 } from 'lucide-react'
import type { Profile } from '@/types/db'
import { Avatar } from '@/components/ui/Avatar'
import { useToast } from '@/components/ui/Toast'
import { changeAvatar } from '@/services/profiles'
import { errorMessage } from '@/lib/supabase'

interface AvatarUploaderProps {
  profile: Profile
  onUpdated: (profile: Profile) => void
}

/** Tap the avatar to pick a photo. The image is validated, resized in the browser, then uploaded to the avatars bucket. */
export function AvatarUploader({ profile, onUpdated }: AvatarUploaderProps) {
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    try {
      onUpdated(await changeAvatar(profile.id, file, profile.avatar_url))
      toast.show('Profile photo updated')
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div className="avatar-edit">
      <button
        type="button"
        className="avatar-edit__btn"
        aria-label="Change profile photo"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        <Avatar src={profile.avatar_url} name={profile.display_name ?? profile.username} size="xl" />
        <span className="avatar-edit__badge" aria-hidden>
          {busy ? <Loader2 size={16} className="spin" /> : <Camera size={16} />}
        </span>
      </button>
      <input
        ref={input}
        className="file-hidden"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
    </div>
  )
}
