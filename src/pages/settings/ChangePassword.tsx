import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/app/AuthProvider'
import { Button } from '@/components/ui/Button'
import { ErrorBanner } from '@/components/ui/Feedback'
import { TextField } from '@/components/ui/Field'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { PageHeader } from '@/components/ui/PageHeader'
import { useToast } from '@/components/ui/Toast'
import { errorMessage, supabase } from '@/lib/supabase'

/** Change password in two steps: first prove it is you with the current password, then choose the new one. */
export default function ChangePasswordPage() {
  const { user, updatePassword } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [step, setStep] = useState<1 | 2>(1)
  const [current, setCurrent] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const verify = async (e: FormEvent) => {
    e.preventDefault()
    if (!current) return setError('Enter your current password.')
    if (!user?.email) return setError('We could not read your email address. Please log in again.')
    setBusy(true)
    setError(null)
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email: user.email, password: current })
      if (err) throw new Error('That password is not correct.')
      setCurrent('')
      setStep(2)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < 8) return setError('Use a password with at least 8 characters.')
    if (password !== confirm) return setError('The two passwords do not match.')
    setBusy(true)
    setError(null)
    try {
      await updatePassword(password)
      toast.show('Password updated')
      navigate('/settings/privacy', { replace: true })
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="Change password" back="/settings/privacy" />
      <div className="stack">
        <GlassPanel padded>
          {step === 1 ? (
            <form className="col" onSubmit={(e) => void verify(e)} noValidate>
              <p className="small muted">For your security, enter your current password first.</p>
              {error ? <ErrorBanner>{error}</ErrorBanner> : null}
              <TextField
                label="Your password"
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
              <div className="form-actions">
                <Button type="submit" variant="primary" loading={busy} disabled={!current}>Verify</Button>
              </div>
              <Link to="/forgot-password" className="small">Forgot password?</Link>
            </form>
          ) : (
            <form className="col" onSubmit={(e) => void save(e)} noValidate>
              {error ? <ErrorBanner>{error}</ErrorBanner> : null}
              <TextField
                label="New password"
                type="password"
                autoComplete="new-password"
                hint="At least 8 characters."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <TextField
                label="Confirm new password"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
              <div className="form-actions">
                <Button type="submit" variant="primary" loading={busy} disabled={!password}>Change password</Button>
              </div>
            </form>
          )}
        </GlassPanel>
      </div>
    </>
  )
}
