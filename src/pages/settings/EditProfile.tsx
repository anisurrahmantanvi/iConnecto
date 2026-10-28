import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, useMe } from '@/app/AuthProvider'
import { AvatarUploader } from '@/components/profile/AvatarUploader'
import { Button } from '@/components/ui/Button'
import { EmojiButton } from '@/components/ui/EmojiButton'
import { TextAreaField, TextField } from '@/components/ui/Field'
import { ErrorBanner } from '@/components/ui/Feedback'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { PageHeader } from '@/components/ui/PageHeader'
import { useToast } from '@/components/ui/Toast'
import { useDebounce } from '@/hooks/common'
import { insertAtCaret, restoreCaret } from '@/hooks/ui'
import { isDuplicate } from '@/lib/api'
import { errorMessage } from '@/lib/supabase'
import { isUsernameAvailable, updateMyProfile, type ProfilePatch } from '@/services/profiles'

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/
const MAX_BIO = 300
const MAX_NAME = 50

type Availability = 'idle' | 'checking' | 'ok' | 'taken' | 'error'

export default function EditProfilePage() {
  const me = useMe()
  const { setProfile } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const bioRef = useRef<HTMLTextAreaElement>(null)

  const [username, setUsername] = useState(me.username)
  const [displayName, setDisplayName] = useState(me.display_name ?? '')
  const [bio, setBio] = useState(me.bio ?? '')
  const [availability, setAvailability] = useState<Availability>('idle')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const debounced = useDebounce(username, 400)
  const settled = username === debounced
  const unchangedUsername = username.toLowerCase() === me.username.toLowerCase()

  // Live availability check (a read-only database function). The unique index is what actually enforces it.
  useEffect(() => {
    if (debounced.toLowerCase() === me.username.toLowerCase() || !USERNAME_RE.test(debounced)) {
      setAvailability('idle')
      return
    }
    let cancelled = false
    setAvailability('checking')
    isUsernameAvailable(debounced)
      .then((ok) => !cancelled && setAvailability(ok ? 'ok' : 'taken'))
      .catch(() => !cancelled && setAvailability('error'))
    return () => {
      cancelled = true
    }
  }, [debounced, me.username])

  const usernameError =
    username && !USERNAME_RE.test(username)
      ? '3–20 letters, numbers or underscores.'
      : settled && !unchangedUsername && availability === 'taken'
        ? 'That username is taken.'
        : null
  const usernameOk = settled && !unchangedUsername && availability === 'ok' ? 'Username is available' : null

  const dirty =
    username !== me.username || displayName.trim() !== (me.display_name ?? '') || bio.trim() !== (me.bio ?? '')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy || !dirty) return
    if (!USERNAME_RE.test(username)) return setError('Choose a username with 3–20 letters, numbers or underscores.')
    if (!unchangedUsername && availability === 'taken' && settled) return setError('That username is taken. Please pick another.')

    const patch: ProfilePatch = {}
    if (username !== me.username) patch.username = username
    if (displayName.trim() !== (me.display_name ?? '')) patch.display_name = displayName.trim() || null
    if (bio.trim() !== (me.bio ?? '')) patch.bio = bio.trim() || null

    setBusy(true)
    setError(null)
    try {
      const updated = await updateMyProfile(me.id, patch)
      setProfile(updated)
      toast.show('Profile updated')
      navigate(`/u/${updated.username}`, { replace: true })
    } catch (err) {
      setError(isDuplicate(err) ? 'That username is taken. Please pick another.' : errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="Edit profile" back />
      <form className="col" onSubmit={(e) => void submit(e)} noValidate>
        <GlassPanel padded className="col">
          {error ? <ErrorBanner>{error}</ErrorBanner> : null}

          <AvatarUploader profile={me} onUpdated={setProfile} />

          <TextField
            label="Display name"
            value={displayName}
            maxLength={MAX_NAME}
            autoComplete="name"
            disabled={busy}
            onChange={(e) => setDisplayName(e.target.value)}
          />

          <TextField
            label="Username"
            value={username}
            maxLength={20}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="username"
            disabled={busy}
            error={usernameError}
            ok={usernameOk}
            hint={availability === 'checking' && settled ? 'Checking…' : 'Your profile link will change if you change this.'}
            onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))}
          />

          <div className="col" style={{ gap: 4 }}>
            <TextAreaField
              ref={bioRef}
              label="Bio"
              value={bio}
              maxLength={MAX_BIO}
              rows={3}
              disabled={busy}
              onChange={(e) => setBio(e.target.value)}
            />
            <div className="row">
              <EmojiButton
                label="Add emoji to bio"
                onPick={(emoji) => {
                  const r = insertAtCaret(bioRef.current, bio, emoji, MAX_BIO)
                  setBio(r.value)
                  restoreCaret(bioRef.current, r.caret)
                }}
              />
              <span className="grow" />
              <span className="char-count" aria-hidden>{bio.length}/{MAX_BIO}</span>
            </div>
          </div>
        </GlassPanel>

        <div className="form-actions">
          <Button variant="ghost" onClick={() => navigate(-1)} disabled={busy}>Cancel</Button>
          <Button type="submit" variant="primary" loading={busy} disabled={!dirty || !!usernameError}>Save</Button>
        </div>
      </form>
    </>
  )
}
