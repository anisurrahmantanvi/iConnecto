import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/app/AuthProvider'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { ONBOARDING_SKIP_KEY } from '@/pages/auth/onboardingKey'

/** Reads an error Supabase may put in the URL (hash or query) when a link is invalid or expired. */
function urlError(): string | null {
  const read = (raw: string) => {
    const p = new URLSearchParams(raw.replace(/^[#?]/, ''))
    return p.get('error_description') ?? p.get('error')
  }
  return read(window.location.hash) ?? read(window.location.search)
}

function wantsOnboarding(avatar: string | null, bio: string | null): boolean {
  if (avatar || bio) return false
  try {
    return localStorage.getItem(ONBOARDING_SKIP_KEY) !== '1'
  } catch {
    return true
  }
}

/**
 * Landing page for links in emails (verify email, reset password, change email).
 * supabase-js reads the tokens from the URL and creates the session; this page waits for that, then routes onward.
 */
export default function AuthCallbackPage() {
  const { session, profile, recovering, loading } = useAuth()
  const navigate = useNavigate()
  const [error] = useState<string | null>(urlError)
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    if (error) return
    if (recovering) {
      navigate('/auth/reset', { replace: true })
      return
    }
    if (!loading && session && profile) {
      navigate(wantsOnboarding(profile.avatar_url, profile.bio) ? '/onboarding' : '/', { replace: true })
    }
  }, [error, recovering, loading, session, profile, navigate])

  useEffect(() => {
    if (error) return
    const id = window.setTimeout(() => setTimedOut(true), 10_000)
    return () => window.clearTimeout(id)
  }, [error])

  if (error || timedOut) {
    return (
      <AuthLayout title="We couldn't complete that" subtitle={error ?? 'This link may have expired or already been used.'}>
        <div className="col">
          <Link to="/login" className="btn btn--primary btn--block">Go to log in</Link>
          <Link to="/forgot-password" className="btn btn--glass btn--block">Reset password</Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Signing you in…">
      <div className="center" role="status" aria-live="polite">
        <Loader2 className="spin" size={28} aria-hidden />
        <span className="sr-only">Completing sign in</span>
      </div>
    </AuthLayout>
  )
}
