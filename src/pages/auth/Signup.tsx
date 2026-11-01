import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { CodeForm } from '@/components/auth/CodeForm'
import { useAuth } from '@/app/AuthProvider'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/Field'
import { ErrorBanner } from '@/components/ui/Feedback'
import { useToast } from '@/components/ui/Toast'
import { useT } from '@/lib/i18n'
import { errorMessage } from '@/lib/supabase'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
type Step = 1 | 2 | 3

/**
 * Sign up in small steps: your name, your email, a password, then the code we email you.
 * No username is asked for: the database makes one from your email, and you can change it in Edit profile.
 */
export default function SignupPage() {
  const { t } = useT()
  const { signUp, resendVerification, verifyEmailCode } = useAuth()
  const toast = useToast()
  const [step, setStep] = useState<Step>(1)
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const id = window.setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => window.clearTimeout(id)
  }, [cooldown])

  const goBack = () => {
    setError(null)
    setStep((s) => (s > 1 ? ((s - 1) as Step) : s))
  }

  const next = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (step === 1) {
      if (displayName.trim().length < 2) return setError('Enter your real name.')
      return setStep(2)
    }
    if (step === 2) {
      if (!EMAIL_RE.test(email.trim())) return setError('Enter a valid email address.')
      return setStep(3)
    }
    if (password.length < 8) return setError('Use a password with at least 8 characters.')
    if (password !== confirm) return setError('The two passwords do not match.')
    setBusy(true)
    try {
      const { needsEmailConfirmation } = await signUp({ email, password, username: '', displayName })
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
      <AuthLayout title="Verify your email" footer={<Link to="/login">Back to log in</Link>}>
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

  const titles: Record<Step, string> = { 1: "What's your name?", 2: "What's your email address?", 3: 'Create a password' }
  const subtitles: Record<Step, string> = {
    1: 'Enter your real name.',
    2: 'We will send a verification code to this email.',
    3: 'Choose a password with at least 8 characters.',
  }

  return (
    <AuthLayout
      title={titles[step]}
      subtitle={subtitles[step]}
      footer={<>{t('auth.haveAccount')} <Link to="/login">{t('auth.login')}</Link></>}
    >
      <form className="col" onSubmit={(e) => void next(e)} noValidate>
        <p className="small muted" style={{ textAlign: 'center' }}>Step {step} of 3</p>
        {error ? <ErrorBanner>{error}</ErrorBanner> : null}
        {step === 1 ? (
          <TextField
            label="Your real name"
            name="name"
            autoComplete="name"
            maxLength={50}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            autoFocus
          />
        ) : null}
        {step === 2 ? (
          <TextField
            label={t('auth.email')}
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
          />
        ) : null}
        {step === 3 ? (
          <>
            <TextField
              label={t('auth.password')}
              type="password"
              name="new-password"
              autoComplete="new-password"
              minLength={8}
              hint="At least 8 characters."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
            <TextField
              label="Confirm new password"
              type="password"
              name="confirm-password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </>
        ) : null}
        <Button type="submit" variant="primary" block loading={busy}>{step === 3 ? t('auth.signup') : 'Next'}</Button>
        {step > 1 ? <Button type="button" variant="ghost" block disabled={busy} onClick={goBack}>Back</Button> : null}
      </form>
    </AuthLayout>
  )
}
