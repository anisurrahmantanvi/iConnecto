import { useRef, useState, type FormEvent } from 'react'
import { Check, MailCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
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
  const [done, setDone] = useState(false)
  const [shake, setShake] = useState(0)
  const [focused, setFocused] = useState(false)
  const ref = useRef<HTMLInputElement>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (code.length < 6) { setShake((n) => n + 1); return setError('Enter the code from the email.') }
    setBusy(true)
    setError(null)
    try {
      await onVerify(code)
      setDone(true)
    } catch (err) {
      setError(errorMessage(err))
      setShake((n) => n + 1)
      setBusy(false)
    }
  }

  return (
    <form className="col" onSubmit={(e) => void submit(e)} noValidate style={{ textAlign: 'center' }}>
      <MailCheck size={40} color="var(--accent)" aria-hidden style={{ alignSelf: 'center' }} />
      <p className="muted">{intro} <strong>{email}</strong></p>
      {error ? <ErrorBanner>{error}</ErrorBanner> : null}
      <div
        key={shake}
        className={`codebox ${shake ? 'is-shake' : ''} ${busy ? 'is-busy' : ''} ${done ? 'is-done' : ''} ${error ? 'is-error' : ''}`}
        onClick={() => ref.current?.focus()}
      >
        {Array.from({ length: Math.min(10, Math.max(6, code.length + (code.length >= 6 ? 1 : 0))) }).map((_, i) => (
          <span key={i} className={`codebox__cell ${code[i] ? 'is-filled' : ''} ${focused && i === Math.min(code.length, 9) ? 'is-active' : ''}`} style={{ animationDelay: `${i * 60}ms` }}>
            {done ? <Check size={18} aria-hidden /> : code[i] ?? ''}
          </span>
        ))}
        <input
          ref={ref}
          className="codebox__input"
          aria-label="Verification code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={10}
          value={code}
          disabled={busy || done}
          autoFocus
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); if (error) setError(null) }}
        />
      </div>
      {done ? <p className="codebox__ok" role="status"><Check size={16} aria-hidden /> Verified</p> : null}
      <Button type="submit" variant="primary" block loading={busy} disabled={done}>{submitLabel}</Button>
      <Button type="button" variant="glass" block disabled={cooldown > 0} onClick={() => void onResend()}>
        {cooldown > 0 ? `Send a new code in ${cooldown}s` : 'Send a new code'}
      </Button>
      <p className="small faint">No email? Check your spam folder, or make sure the address is spelled correctly.</p>
    </form>
  )
}
