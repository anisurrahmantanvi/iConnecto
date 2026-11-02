import { useState, type FormEvent } from 'react'
import { ShieldCheck } from 'lucide-react'
import { useAuth } from '@/app/AuthProvider'
import { Button } from '@/components/ui/Button'
import { ErrorBanner } from '@/components/ui/Feedback'
import { TextField } from '@/components/ui/Field'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { errorMessage } from '@/lib/supabase'
import { verifyTotp } from '@/services/security'

/** Second login step: the 6-digit code from the authenticator app. */
export function MfaChallenge({ factorId, onDone }: { factorId: string; onDone: () => void }) {
  const { signOut } = useAuth()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (code.length < 6) return setError('Enter the 6-digit code from your app.')
    setBusy(true)
    setError(null)
    try {
      await verifyTotp(factorId, code)
      onDone()
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <div className="auth">
      <GlassPanel className="auth__card">
        <form className="col" onSubmit={(e) => void submit(e)} noValidate style={{ textAlign: 'center' }}>
          <ShieldCheck size={40} color="var(--accent)" aria-hidden style={{ alignSelf: 'center' }} />
          <h1>Two-step verification</h1>
          <p className="muted">Enter the 6-digit code from your authenticator app.</p>
          {error ? <ErrorBanner>{error}</ErrorBanner> : null}
          <TextField
            label="Code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            style={{ textAlign: 'center', letterSpacing: '0.3em', fontSize: '1.3rem' }}
          />
          <Button type="submit" variant="primary" block loading={busy}>Verify</Button>
          <Button type="button" variant="ghost" block onClick={() => void signOut()}>Log out</Button>
        </form>
      </GlassPanel>
    </div>
  )
}
