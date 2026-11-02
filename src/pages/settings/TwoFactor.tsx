import { useState, type FormEvent } from 'react'
import { ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ErrorBanner, Spinner } from '@/components/ui/Feedback'
import { TextField } from '@/components/ui/Field'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { PageHeader } from '@/components/ui/PageHeader'
import { useToast } from '@/components/ui/Toast'
import { useAsync } from '@/hooks/common'
import { errorMessage } from '@/lib/supabase'
import { enrollTotp, listTotp, removeTotp, verifyTotp } from '@/services/security'

/** Two-factor authentication with an authenticator app (Google Authenticator, Microsoft Authenticator, Authy...). */
export default function TwoFactorPage() {
  const toast = useToast()
  const { data, loading, error: loadError, reload } = useAsync(listTotp, [])
  const [setup, setSetup] = useState<{ id: string; qr: string; secret: string } | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmOff, setConfirmOff] = useState(false)

  const active = (data ?? []).find((f) => f.status === 'verified')

  const start = async () => {
    setBusy(true)
    setError(null)
    try {
      setSetup(await enrollTotp())
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const confirm = async (e: FormEvent) => {
    e.preventDefault()
    if (!setup) return
    if (code.length < 6) return setError('Enter the 6-digit code from your app.')
    setBusy(true)
    setError(null)
    try {
      await verifyTotp(setup.id, code)
      setSetup(null)
      setCode('')
      toast.show('Two-factor authentication is on')
      reload()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const turnOff = async () => {
    if (!active) return
    await removeTotp(active.id)
    toast.show('Two-factor authentication is off')
    reload()
  }

  return (
    <>
      <PageHeader title="Two-Factor Authentication" back="/settings/section/advanced-account-protection" />
      <div className="stack">
        {loading ? <Spinner label="Loading" /> : null}
        {loadError ? <ErrorBanner>{loadError}</ErrorBanner> : null}
        {error ? <ErrorBanner>{error}</ErrorBanner> : null}

        {!loading && !setup && active ? (
          <GlassPanel padded className="col">
            <div className="row"><ShieldCheck size={22} color="var(--success)" aria-hidden /><strong>Two-factor is ON</strong></div>
            <p className="small muted">When you log in, we ask for a 6-digit code from your authenticator app after your password.</p>
            <div><Button variant="glass" onClick={() => setConfirmOff(true)}>Turn off</Button></div>
          </GlassPanel>
        ) : null}

        {!loading && !setup && !active && !loadError ? (
          <GlassPanel padded className="col">
            <strong>Protect your account with a second step</strong>
            <p className="small muted">Install an authenticator app (Google Authenticator, Microsoft Authenticator or Authy), scan a code, and confirm. After that, logging in needs your password and a 6-digit code.</p>
            <div><Button variant="primary" loading={busy} onClick={() => void start()}>Set up</Button></div>
          </GlassPanel>
        ) : null}

        {setup ? (
          <GlassPanel padded>
            <form className="col" onSubmit={(e) => void confirm(e)} noValidate>
              <p className="small muted">1. Open your authenticator app and scan this code.</p>
              <img src={setup.qr} alt="Authenticator QR code" width={200} height={200} style={{ alignSelf: 'center', background: '#fff', borderRadius: 12, padding: 8 }} />
              <p className="small muted">Can't scan? Enter this key in the app instead:</p>
              <code style={{ overflowWrap: 'anywhere', userSelect: 'all' }}>{setup.secret}</code>
              <p className="small muted">2. Enter the 6-digit code the app shows.</p>
              <TextField
                label="Code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              />
              <div className="form-actions">
                <Button type="button" variant="ghost" onClick={() => { setSetup(null); setCode('') }}>Cancel</Button>
                <Button type="submit" variant="primary" loading={busy}>Turn on</Button>
              </div>
            </form>
          </GlassPanel>
        ) : null}
      </div>
      <ConfirmDialog
        open={confirmOff}
        title="Turn off two-factor?"
        message="Your account will be protected by your password only."
        confirmLabel="Turn off"
        danger
        onConfirm={turnOff}
        onClose={() => setConfirmOff(false)}
      />
    </>
  )
}
