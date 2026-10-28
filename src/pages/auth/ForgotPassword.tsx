import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import { useAuth } from '@/app/AuthProvider'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/Field'
import { ErrorBanner } from '@/components/ui/Feedback'
import { errorMessage } from '@/lib/supabase'

export default function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return setError('Enter the email address you signed up with.')
    setBusy(true)
    setError(null)
    try {
      await requestPasswordReset(email)
      setSent(true)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <AuthLayout title="Check your email" footer={<Link to="/login">Back to log in</Link>}>
        <div className="col" style={{ alignItems: 'center', textAlign: 'center' }}>
          <MailCheck size={40} color="var(--accent)" aria-hidden />
          {/* The wording is identical whether or not the address has an account, so it cannot be used to probe for accounts. */}
          <p className="muted">If an account exists for that address, a reset link is on its way. It can take a minute to arrive.</p>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="We'll email you a link to choose a new one."
      footer={<Link to="/login">Back to log in</Link>}
    >
      <form className="col" onSubmit={(e) => void submit(e)} noValidate>
        {error ? <ErrorBanner>{error}</ErrorBanner> : null}
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Button type="submit" variant="primary" block loading={busy}>Send reset link</Button>
      </form>
    </AuthLayout>
  )
}
