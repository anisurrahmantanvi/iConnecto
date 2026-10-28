import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/app/AuthProvider'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/Field'
import { ErrorBanner } from '@/components/ui/Feedback'
import { useToast } from '@/components/ui/Toast'
import { useT } from '@/lib/i18n'
import { errorMessage } from '@/lib/supabase'

export default function LoginPage() {
  const { t } = useT()
  const { signIn, resendVerification } = useAuth()
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unconfirmed, setUnconfirmed] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) {
      setError('Enter your email and password.')
      return
    }
    setBusy(true)
    setError(null)
    setUnconfirmed(false)
    try {
      await signIn(email, password)
      // On success the route guard redirects away from this page.
    } catch (err) {
      const msg = errorMessage(err)
      setUnconfirmed(/not confirmed/i.test(msg))
      setError(/not confirmed/i.test(msg) ? 'Please verify your email address first. Check your inbox for the link.' : msg)
    } finally {
      setBusy(false)
    }
  }

  const resend = async () => {
    try {
      await resendVerification(email)
      toast.show('Verification email sent')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to keep connecting."
      footer={<>{t('auth.newHere')} <Link to="/signup">{t('auth.signup')}</Link></>}
    >
      <form className="col" onSubmit={(e) => void submit(e)} noValidate>
        {error ? <ErrorBanner>{error}</ErrorBanner> : null}
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
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Button type="submit" variant="primary" block loading={busy}>{t('auth.login')}</Button>
        {unconfirmed ? <Button variant="glass" block onClick={() => void resend()}>Resend verification email</Button> : null}
        <div className="center small"><Link to="/forgot-password">{t('auth.forgot')}</Link></div>
      </form>
    </AuthLayout>
  )
}
