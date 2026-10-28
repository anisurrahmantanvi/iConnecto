import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, useMe } from '@/app/AuthProvider'
import { AvatarUploader } from '@/components/profile/AvatarUploader'
import { FollowButton } from '@/components/profile/FollowButton'
import { UserRow } from '@/components/profile/UserList'
import { Button } from '@/components/ui/Button'
import { TextAreaField, TextField } from '@/components/ui/Field'
import { ErrorBanner, ListSkeleton } from '@/components/ui/Feedback'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { useAsync } from '@/hooks/common'
import { errorMessage } from '@/lib/supabase'
import { suggestedProfiles, updateMyProfile } from '@/services/profiles'
import { markOnboardingDone } from './onboardingKey'

/** Optional first-run setup: photo, name, bio and a few people to follow. Everything here can be skipped. */
export default function OnboardingPage() {
  const me = useMe()
  const { setProfile } = useAuth()
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState(me.display_name ?? '')
  const [bio, setBio] = useState(me.bio ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [following, setFollowing] = useState<Record<string, boolean>>({})
  const suggestions = useAsync(() => suggestedProfiles(me.id, 6), [me.id])

  const finish = async () => {
    setBusy(true)
    setError(null)
    try {
      const name = displayName.trim()
      const changed = name !== (me.display_name ?? '') || bio.trim() !== (me.bio ?? '')
      if (changed) setProfile(await updateMyProfile(me.id, { display_name: name || null, bio: bio.trim() || null }))
      markOnboardingDone()
      navigate('/', { replace: true })
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  const skip = () => {
    markOnboardingDone()
    navigate('/', { replace: true })
  }

  return (
    <div className="auth">
      <GlassPanel strong sheen className="auth__card" as="main" style={{ width: 'min(100%, 480px)' }}>
        <div className="col" style={{ alignItems: 'center', textAlign: 'center' }}>
          <h1>Set up your profile</h1>
          <p className="muted">Add a photo and a few words so people know who you are. You can change this any time.</p>
          <AvatarUploader profile={me} onUpdated={setProfile} />
        </div>

        {error ? <ErrorBanner>{error}</ErrorBanner> : null}

        <TextField label="Display name" maxLength={50} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        <TextAreaField
          label="Bio"
          maxLength={300}
          rows={3}
          hint={`${bio.length}/300`}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
        />

        <section className="col" aria-label="People you may know">
          <h2>People to follow</h2>
          {suggestions.loading ? (
            <ListSkeleton rows={3} />
          ) : suggestions.data && suggestions.data.length ? (
            <div className="glass">
              {suggestions.data.map((p) => (
                <UserRow
                  key={p.id}
                  profile={p}
                  right={
                    <FollowButton
                      targetId={p.id}
                      following={!!following[p.id]}
                      onChange={(on) => setFollowing((f) => ({ ...f, [p.id]: on }))}
                    />
                  }
                />
              ))}
            </div>
          ) : (
            <p className="small muted">Nobody to suggest yet. You can find people from Discover.</p>
          )}
        </section>

        <Button variant="primary" block loading={busy} onClick={() => void finish()}>Continue</Button>
        <Button variant="ghost" block disabled={busy} onClick={skip}>Skip for now</Button>
      </GlassPanel>
    </div>
  )
}
