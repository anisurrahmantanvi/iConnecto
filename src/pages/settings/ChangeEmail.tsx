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
  const [step, setStep] = useState<0 | 1 | 2 | 3 | 4>(0)
  const [newEmail, setNewEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const id = window.setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => window.clearTimeout(id)
  }, [cooldown])

  const sendOld = async () => {
    const { error: err } = await supabase.auth.signInWithOtp({ email: oldEmail, options: { shouldCreateUser: false } })
    if (err) throw new Error(err.message)
    setCooldown(60)
  }

  const startOld = async () => {
    setBusy(true)
    setError(null)
    try {
      await sendOld()
      setStep(1)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const verifyCurrent = async (code: string) => {
    const { error: err } = await supabase.auth.verifyOtp({ email: oldEmail, token: code.replace(/\s+/g, ''), type: 'email' })
    if (err) throw new Error(/expired|invalid/i.test(err.message) ? 'That code is wrong or has expired. Check it or request a new one.' : err.message)
    setCooldown(0)
    setStep(2)
  }

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
      setStep(3)
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
    if (data.user?.new_email) setStep(4)
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
          {step === 0 ? (
            <div className="col">
              <p className="small muted">First we confirm it is you. We will send a code to your current email <strong>{oldEmail}</strong>.</p>
              {error ? <ErrorBanner>{error}</ErrorBanner> : null}
              <div className="form-actions">
                <Button variant="primary" loading={busy} onClick={() => void startOld()}>Send code</Button>
              </div>
            </div>
          ) : step === 1 ? (
            <CodeForm
              email={oldEmail}
              intro="Verify your current email. We sent a code to"
              submitLabel="Verify"
              onVerify={verifyCurrent}
              onResend={async () => { try { await sendOld(); toast.show('New code sent') } catch (err) { toast.error(errorMessage(err)) } }}
              cooldown={cooldown}
            />
          ) : step === 2 ? (
            <form className="col" onSubmit={(e) => void submit(e)} noValidate>
              <p className="small muted">Verified. Now enter the new address you want to use.</p>
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
          ) : step === 3 ? (
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
