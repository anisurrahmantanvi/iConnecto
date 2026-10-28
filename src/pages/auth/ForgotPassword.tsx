import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CodeForm } from '@/components/auth/CodeForm'
import { useAuth } from '@/app/AuthProvider'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/Field'
import { ErrorBanner } from '@/components/ui/Feedback'
import { errorMessage } from '@/lib/supabase'

export default function ForgotPasswordPage() {
  const { requestPasswordReset, verifyEmailCode } = useAuth()
  const navigate = useNavigate()
  const [cooldown, setCooldown] = useState(0)
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
      setCooldown(30)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (cooldown <= 0) return
    const id = window.setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => window.clearTimeout(id)
  }, [cooldown])

  if (sent) {
    return (
      <AuthLayout title="Enter your code" footer={<Link to="/login">Back to log in</Link>}>
        <CodeForm
          email={email.trim()}
          // The wording is identical whether or not the address has an account, so it cannot be used to probe for accounts.
          intro="If an account exists, we sent a reset code to"
          submitLabel="Continue"
          onVerify={async (code) => {
            await verifyEmailCode(email, code, 'recovery')
            navigate('/reset-password', { replace: true })
          }}
          onResend={async () => {
            await requestPasswordReset(email)
            setCooldown(30)
          }}
          cooldown={cooldown}
        />
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="We'll email you a code to choose a new one."
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
        <Button type="submit" variant="primary" block loading={busy}>Send reset code</Button>
      </form>
    </AuthLayout>
  )
}
