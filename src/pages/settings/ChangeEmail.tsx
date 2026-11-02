import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/app/AuthProvider'
import { CodeForm } from '@/components/auth/CodeForm'
import { Button } from '@/components/ui/Button'
import { ErrorBanner } from '@/components/ui/Feedback'
import { TextField } from '@/components/ui/Field'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { PageHeader } from '@/components/ui/PageHeader'
import { useToast } from '@/components/ui/Toast'
import { errorMessage, supabase } from '@/lib/supabase'
import { updateEmail } from '@/services/account'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Change email in two steps: enter the new address, then confirm it with the code we send there. */
export default function ChangeEmailPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const oldEmail = user?.email ?? ''
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [newEmail, setNewEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const id = window.setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => window.clearTimeout(id)
  }, [cooldown])

  const send = async () => {
    await updateEmail(newEmail)
    setCooldown(60)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const value = newEmail.trim()
    if (!EMAIL_RE.test(value)) return setError('Enter a valid email address.')
    if (value.toLowerCase() === oldEmail.toLowerCase()) return setError('That is already your email address.')
    setBusy(true)
    setError(null)
    try {
      await send()
      setStep(2)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const finish = () => {
    toast.show('Email updated')
    navigate('/settings/account', { replace: true })
  }

  const verifyNew = async (code: string) => {
    const token = code.replace(/\s+/g, '')
    const { error: err } = await supabase.auth.verifyOtp({ email: newEmail.trim(), token, type: 'email_change' })
    if (err) throw new Error(/expired|invalid/i.test(err.message) ? 'That code is wrong or has expired. Check it or request a new one.' : err.message)
    // Projects with "secure email change" also send a code to the old address.
    const { data } = await supabase.auth.getUser()
    if (data.user?.new_email) setStep(3)
    else finish()
  }

  const verifyOld = async (code: string) => {
    const token = code.replace(/\s+/g, '')
    const { error: err } = await supabase.auth.verifyOtp({ email: oldEmail, token, type: 'email_change' })
    if (err) throw new Error(/expired|invalid/i.test(err.message) ? 'That code is wrong or has expired. Check it or request a new one.' : err.message)
    finish()
  }

  const resend = async () => {
    try {
      await send()
      toast.show('New code sent')
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <>
      <PageHeader title="Change email" back="/settings/account" />
      <div className="stack">
        <GlassPanel padded>
          {step === 1 ? (
            <form className="col" onSubmit={(e) => void submit(e)} noValidate>
              <p className="small muted">Your current email is <strong>{oldEmail}</strong>. Enter the new address you want to use.</p>
              {error ? <ErrorBanner>{error}</ErrorBanner> : null}
              <TextField
                label="New email address"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
              <div className="form-actions">
                <Button type="submit" variant="primary" loading={busy} disabled={!newEmail.trim()}>Next</Button>
              </div>
            </form>
          ) : step === 2 ? (
            <CodeForm
              email={newEmail.trim()}
              intro="Verify your new email. We sent a code to"
              submitLabel="Verify email"
              onVerify={verifyNew}
              onResend={resend}
              cooldown={cooldown}
            />
          ) : (
            <CodeForm
              email={oldEmail}
              intro="One more step for your security. We sent a code to your old email"
              submitLabel="Confirm change"
              onVerify={verifyOld}
              onResend={resend}
              cooldown={cooldown}
            />
          )}
        </GlassPanel>
      </div>
    </>
  )
}
