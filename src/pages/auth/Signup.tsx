import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { CodeForm } from '@/components/auth/CodeForm'
import { useAuth } from '@/app/AuthProvider'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/Field'
import { ErrorBanner } from '@/components/ui/Feedback'
import { useToast } from '@/components/ui/Toast'
import { useDebounce } from '@/hooks/common'
import { useT } from '@/lib/i18n'
import { errorMessage } from '@/lib/supabase'
import { isUsernameAvailable } from '@/services/profiles'

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/
type Availability = 'idle' | 'checking' | 'ok' | 'taken' | 'invalid' | 'error'

export default function SignupPage() {
  const { t } = useT()
  const { signUp, resendVerification, verifyEmailCode } = useAuth()
  const toast = useToast()
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)
  const [availability, setAvailability] = useState<Availability>('idle')

  const debounced = useDebounce(username, 400)

  // Live username check (a read-only database function; the unique index is what actually enforces it).
  useEffect(() => {
    if (!debounced) {
      setAvailability('idle')
      return
    }
    if (!USERNAME_RE.test(debounced)) {
      setAvailability('invalid')
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
  }, [debounced])

  useEffect(() => {
    if (cooldown <= 0) return
    const id = window.setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => window.clearTimeout(id)
  }, [cooldown])

  const settled = username === debounced
  const usernameError =
    settled && availability === 'invalid' ? 'Use 3–20 letters, numbers or underscores.'
    : settled && availability === 'taken' ? 'That username is taken.'
    : null
  const usernameOk = settled && availability === 'ok' ? 'Username is available' : null
  const usernameHint = !usernameError && !usernameOk
    ? availability === 'error' && settled ? 'Could not check availability right now; we will verify when you sign up.' : 'Letters, numbers and underscores.'
    : null

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!USERNAME_RE.test(username)) return setError('Choose a username with 3–20 letters, numbers or underscores.')
    if (availability === 'taken' && settled) return setError('That username is taken. Please pick another.')
    if (!email.trim()) return setError('Enter your email address.')
    if (password.length < 8) return setError('Use a password with at least 8 characters.')
    setBusy(true)
    try {
      const { needsEmailConfirmation } = await signUp({ email, password, username, displayName })
      if (needsEmailConfirmation) {
        setSentTo(email.trim())
        setCooldown(30)
      }
      // Otherwise a session already exists and the route guard moves the user into the app.
    } catch (err) {
      const msg = errorMessage(err)
      setError(/already registered|already been registered/i.test(msg) ? 'An account with this email already exists. Try logging in.' : msg)
    } finally {
      setBusy(false)
    }
  }

  const resend = async () => {
    if (!sentTo || cooldown > 0) return
    try {
      await resendVerification(sentTo)
      setCooldown(30)
      toast.show('A new code was sent')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  if (sentTo) {
    return (
      <AuthLayout title="Enter your code" footer={<Link to="/login">Back to log in</Link>}>
        <CodeForm
          email={sentTo}
          intro="We sent a verification code to"
          submitLabel="Confirm and continue"
          onVerify={(code) => verifyEmailCode(sentTo, code, 'signup')}
          onResend={resend}
          cooldown={cooldown}
        />
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Join iConnecto in a minute."
      footer={<>{t('auth.haveAccount')} <Link to="/login">{t('auth.login')}</Link></>}
    >
      <form className="col" onSubmit={(e) => void submit(e)} noValidate>
        {error ? <ErrorBanner>{error}</ErrorBanner> : null}
        <TextField
          label={t('auth.displayName')}
          name="name"
          autoComplete="name"
          maxLength={50}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        <TextField
          label={t('auth.username')}
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={20}
          value={username}
          onChange={(e) => setUsername(e.target.value.trim())}
          error={usernameError}
          ok={usernameOk}
          hint={usernameHint}
          required
        />
        <TextField
          label={t('auth.email')}
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <TextField
          label={t('auth.password')}
          type="password"
          name="new-password"
          autoComplete="new-password"
          minLength={8}
          hint="At least 8 characters."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Button type="submit" variant="primary" block loading={busy}>{t('auth.signup')}</Button>
      </form>
    </AuthLayout>
  )
}
