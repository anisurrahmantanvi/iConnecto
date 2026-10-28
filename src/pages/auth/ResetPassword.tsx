import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/app/AuthProvider'
import { Splash } from '@/app/guards'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/Field'
import { ErrorBanner } from '@/components/ui/Feedback'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/lib/supabase'

/** Reached from the password-reset email (through /auth/callback). The recovery link signs the user in temporarily. */
export default function ResetPasswordPage() {
  const { session, loading, updatePassword } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (loading) return <Splash />

  if (!session) {
    return (
      <AuthLayout title="This link has expired" subtitle="Reset links work once and only for a short time.">
        <Link to="/forgot-password" className="btn btn--primary btn--block">Request a new link</Link>
      </AuthLayout>
    )
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < 8) return setError('Use a password with at least 8 characters.')
    if (password !== confirm) return setError('The two passwords do not match.')
    setBusy(true)
    setError(null)
    try {
      await updatePassword(password)
      toast.show('Password updated')
      navigate('/', { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title="Choose a new password">
      <form className="col" onSubmit={(e) => void submit(e)} noValidate>
        {error ? <ErrorBanner>{error}</ErrorBanner> : null}
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          hint="At least 8 characters."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <TextField
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
        <Button type="submit" variant="primary" block loading={busy}>Update password</Button>
      </form>
    </AuthLayout>
  )
}
