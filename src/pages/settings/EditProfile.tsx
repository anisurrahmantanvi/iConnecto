import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, useMe } from '@/app/AuthProvider'
import { AvatarUploader } from '@/components/profile/AvatarUploader'
import { CoverUploader } from '@/components/profile/CoverUploader'
import { Button } from '@/components/ui/Button'
import { EmojiButton } from '@/components/ui/EmojiButton'
import { TextAreaField, TextField } from '@/components/ui/Field'
import { SuggestField } from '@/components/ui/SuggestField'
import { ErrorBanner } from '@/components/ui/Feedback'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { PageHeader } from '@/components/ui/PageHeader'
import { useToast } from '@/components/ui/Toast'
import { useDebounce } from '@/hooks/common'
import { insertAtCaret, restoreCaret } from '@/hooks/ui'
import { searchSuggestions, type SuggestEntry } from '@/lib/suggest'
import { isDuplicate } from '@/lib/api'
import { errorMessage } from '@/lib/supabase'
import { getProfileAbout, isUsernameAvailable, updateMyAbout, updateMyProfile, type ProfilePatch } from '@/services/profiles'
import type { ProfileAbout, RelationshipStatus } from '@/types/db'

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/
const MAX_BIO = 300
const MAX_NAME = 50
const MAX_ABOUT = 80

// The suggestion lists are loaded only when this screen opens (they are a separate download, not part of the main app).
let placeList: SuggestEntry[] | null = null
let schoolList: SuggestEntry[] | null = null

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

  // "About" details are loaded separately; if the columns are not available yet the section is simply hidden.
  const [aboutSaved, setAboutSaved] = useState<ProfileAbout | null>(null)
  const [work, setWork] = useState('')
  const [education, setEducation] = useState('')
  const [place, setPlace] = useState('')
  const [status, setStatus] = useState<RelationshipStatus | null>(null)
  const [lists, setLists] = useState(0)
  useEffect(() => {
    let cancelled = false
    void Promise.all([import('@/data/bdPlaces'), import('@/data/bdEducation')]).then(([p, e]) => {
      placeList = p.PLACES.map(([en, bn]) => ({ en, bn }))
      schoolList = e.INSTITUTIONS.map(([en, bn, alt]) => ({ en, bn, alt }))
      if (!cancelled) setLists((n) => n + 1)
    })
    return () => {
      cancelled = true
    }
  }, [])
  useEffect(() => {
    let cancelled = false
    getProfileAbout(me.id)
      .then((a) => {
        if (cancelled || !a) return
        setAboutSaved(a)
        setWork(a.work ?? '')
        setEducation(a.education ?? '')
        setPlace(a.location ?? '')
        setStatus(a.relationship_status)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [me.id])
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

  const aboutDirty =
    !!aboutSaved &&
    (work.trim() !== (aboutSaved.work ?? '') ||
      education.trim() !== (aboutSaved.education ?? '') ||
      place.trim() !== (aboutSaved.location ?? '') ||
      status !== aboutSaved.relationship_status)
  const dirty =
    username !== me.username || displayName.trim() !== (me.display_name ?? '') || bio.trim() !== (me.bio ?? '') || aboutDirty

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
      const updated = Object.keys(patch).length ? await updateMyProfile(me.id, patch) : me
      if (aboutDirty) {
        await updateMyAbout(me.id, {
          work: work.trim() || null,
          education: education.trim() || null,
          location: place.trim() || null,
          relationship_status: status,
        })
      }
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

          <CoverUploader profile={me} onUpdated={setProfile} />
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

        {aboutSaved ? (
          <GlassPanel padded className="col">
            <h2 className="section-title" style={{ margin: 0 }}>About</h2>
            <TextField label="Work" value={work} maxLength={MAX_ABOUT} disabled={busy} placeholder="e.g. Designer at a company" onChange={(e) => setWork(e.target.value)} />
            <SuggestField
              label="Education"
              value={education}
              maxLength={MAX_ABOUT}
              disabled={busy}
              placeholder="e.g. University of Dhaka"
              hint="Start typing and pick from the list, or write your own."
              suggest={(q) => (lists >= 0 && schoolList ? searchSuggestions(schoolList, q) : [])}
              onChange={setEducation}
            />
            <SuggestField
              label="Location"
              value={place}
              maxLength={MAX_ABOUT}
              disabled={busy}
              placeholder="e.g. Jamalpur"
              hint="Type your area (English or বাংলা) and pick from the list."
              suggest={(q) => (lists >= 0 && placeList ? searchSuggestions(placeList, q) : [])}
              onChange={setPlace}
            />
            <div className="field">
              <span className="field-label" id="rel-label">Relationship status</span>
              <div role="group" aria-labelledby="rel-label" className="chip-row">
                {([[null, 'Not set'], ['single', 'Single'], ['married', 'Married']] as const).map(([value, label]) => (
                  <button key={label} type="button" className="chip" aria-pressed={status === value} disabled={busy} onClick={() => setStatus(value)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </GlassPanel>
        ) : null}

        <div className="form-actions">
          <Button variant="ghost" onClick={() => navigate(-1)} disabled={busy}>Cancel</Button>
          <Button type="submit" variant="primary" loading={busy} disabled={!dirty || !!usernameError}>Save</Button>
        </div>
      </form>
    </>
  )
}
