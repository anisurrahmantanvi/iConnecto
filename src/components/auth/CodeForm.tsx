import { useState, type FormEvent } from 'react'
import { MailCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/Field'
import { ErrorBanner } from '@/components/ui/Feedback'
import { errorMessage } from '@/lib/supabase'

interface Props {
  email: string
  /** Shown above the field, e.g. "We sent a code to ...". */
  intro: string
  submitLabel: string
  onVerify: (code: string) => Promise<void>
  onResend: () => Promise<void>
  cooldown: number
}

/** One-time-code entry used after sign-up and during password reset. Codes are 6 to 10 digits depending on the project. */
export function CodeForm({ email, intro, submitLabel, onVerify, onResend, cooldown }: Props) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (code.length < 6) return setError('Enter the code from the email.')
    setBusy(true)
    setError(null)
    try {
      await onVerify(code)
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <form className="col" onSubmit={(e) => void submit(e)} noValidate style={{ textAlign: 'center' }}>
      <MailCheck size={40} color="var(--accent)" aria-hidden style={{ alignSelf: 'center' }} />
      <p className="muted">{intro} <strong>{email}</strong></p>
      {error ? <ErrorBanner>{error}</ErrorBanner> : null}
      <TextField
        label="Verification code"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={10}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        style={{ textAlign: 'center', letterSpacing: '0.3em', fontSize: '1.3rem' }}
        required
      />
      <Button type="submit" variant="primary" block loading={busy}>{submitLabel}</Button>
      <Button type="button" variant="glass" block disabled={cooldown > 0} onClick={() => void onResend()}>
        {cooldown > 0 ? `Send a new code in ${cooldown}s` : 'Send a new code'}
      </Button>
      <p className="small faint">No email? Check your spam folder, or make sure the address is spelled correctly.</p>
    </form>
  )
}
