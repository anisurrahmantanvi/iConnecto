import { useEffect, useState, type FormEvent } from 'react'
import { ChevronRight, Copy, KeyRound, Mail, ShieldCheck, Smartphone } from 'lucide-react'
import { useAuth } from '@/app/AuthProvider'
import { CodeForm } from '@/components/auth/CodeForm'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ErrorBanner, Spinner } from '@/components/ui/Feedback'
import { TextField } from '@/components/ui/Field'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { PageHeader } from '@/components/ui/PageHeader'
import { useToast } from '@/components/ui/Toast'
import { useAsync } from '@/hooks/common'
import { errorMessage } from '@/lib/supabase'
import {
  emailStepOn, enrollTotp, listTotp, removeTotp, sendEmailStepCode, setEmailStep, verifyEmailStepCode, verifyTotp,
} from '@/services/security'

type View = 'menu' | 'app' | 'email'

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch {
      return false
    }
  }
}

/** Two-step verification: choose a method (authenticator app, email code; passkey is not available yet). */
export default function TwoFactorPage() {
  const toast = useToast()
  const { user } = useAuth()
  const email = user?.email ?? ''
  const { data, loading, error: loadError, reload } = useAsync(listTotp, [])
  const [view, setView] = useState<View>('menu')
  const appOn = (data ?? []).some((f) => f.status === 'verified')
  const emailOn = emailStepOn(user)

  const back = view === 'menu' ? '/settings/section/advanced-account-protection' : '/settings/two-factor'
  return (
    <>
      <PageHeader title="Two-Step Verification" back={back} />
      <div className="stack">
        {view === 'menu' ? (
          <>
            <p className="small muted">Add a second step to logging in. Pick the ways you want to use.</p>
            {loading ? <Spinner label="Loading" /> : null}
            {loadError ? <ErrorBanner>{loadError}</ErrorBanner> : null}
            <GlassPanel className="settings-list" as="nav" aria-label="Methods">
              <button type="button" className="list-row" style={{ width: '100%', textAlign: 'left' }} onClick={() => setView('app')}>
                <Smartphone size={20} aria-hidden />
                <span className="grow"><strong style={{ display: 'block' }}>Authenticator app</strong><span className="small muted">{appOn ? 'On' : 'Off'} · 6-digit code from an app</span></span>
                <ChevronRight size={18} className="chev" aria-hidden />
              </button>
              <button type="button" className="list-row" style={{ width: '100%', textAlign: 'left' }} onClick={() => setView('email')}>
                <Mail size={20} aria-hidden />
                <span className="grow"><strong style={{ display: 'block' }}>Email code</strong><span className="small muted">{emailOn ? 'On' : 'Off'} · code sent to {email || 'your email'}</span></span>
                <ChevronRight size={18} className="chev" aria-hidden />
              </button>
              <button type="button" className="list-row" style={{ width: '100%', textAlign: 'left' }} onClick={() => toast.show('Passkey is not available yet')}>
                <KeyRound size={20} aria-hidden />
                <span className="grow"><strong style={{ display: 'block' }}>Passkey</strong><span className="small muted">Coming soon</span></span>
                <ChevronRight size={18} className="chev" aria-hidden />
              </button>
            </GlassPanel>
          </>
        ) : null}
        {view === 'app' ? <AppMethod active={(data ?? []).find((f) => f.status === 'verified')?.id ?? null} onChanged={() => { reload(); setView('menu') }} /> : null}
        {view === 'email' ? <EmailMethod email={email} on={emailOn} onChanged={() => setView('menu')} /> : null}
      </div>
    </>
  )
}

function AppMethod({ active, onChanged }: { active: string | null; onChanged: () => void }) {
  const toast = useToast()
  const [setup, setSetup] = useState<{ id: string; qr: string; secret: string } | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmOff, setConfirmOff] = useState(false)

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
      toast.show('Authenticator app is on')
      onChanged()
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  const turnOff = async () => {
    if (!active) return
    await removeTotp(active)
    toast.show('Authenticator app is off')
    onChanged()
  }

  const copyKey = async () => {
    if (setup && (await copyText(setup.secret))) toast.show('Key copied')
    else toast.error('Could not copy. Press and hold the key to copy it.')
  }

  return (
    <>
      {error ? <ErrorBanner>{error}</ErrorBanner> : null}
      {!setup && active ? (
        <GlassPanel padded className="col">
          <div className="row"><ShieldCheck size={22} color="var(--success)" aria-hidden /><strong>Authenticator app is ON</strong></div>
          <p className="small muted">When you log in, we ask for a 6-digit code from your authenticator app after your password.</p>
          <div><Button variant="glass" onClick={() => setConfirmOff(true)}>Turn off</Button></div>
        </GlassPanel>
      ) : null}
      {!setup && !active ? (
        <GlassPanel padded className="col">
          <strong>Authenticator app</strong>
          <p className="small muted">Install Google Authenticator, Microsoft Authenticator or Authy. You will scan a QR code (or copy a key) and confirm with a 6-digit code.</p>
          <div><Button variant="primary" loading={busy} onClick={() => void start()}>Set up</Button></div>
        </GlassPanel>
      ) : null}
      {setup ? (
        <GlassPanel padded>
          <form className="col" onSubmit={(e) => void confirm(e)} noValidate>
            <p className="small muted">1. Open your authenticator app and scan this QR code.</p>
            <img src={setup.qr} alt="Authenticator QR code" width={200} height={200} style={{ alignSelf: 'center', background: '#fff', borderRadius: 12, padding: 8 }} />
            <p className="small muted">Scanning on the same phone? Copy this key, then in the app choose "Enter a setup key" and paste it.</p>
            <code style={{ overflowWrap: 'anywhere', userSelect: 'all' }}>{setup.secret}</code>
            <div><Button type="button" variant="glass" size="sm" onClick={() => void copyKey()}><Copy size={16} aria-hidden /> Copy key</Button></div>
            <p className="small muted">2. Enter the 6-digit code the app shows.</p>
            <TextField label="Code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
            <div className="form-actions">
              <Button type="button" variant="ghost" onClick={() => { setSetup(null); setCode('') }}>Cancel</Button>
              <Button type="submit" variant="primary" loading={busy}>Turn on</Button>
            </div>
          </form>
        </GlassPanel>
      ) : null}
      <ConfirmDialog
        open={confirmOff}
        title="Turn off authenticator app?"
        message="Logging in will no longer ask for an app code."
        confirmLabel="Turn off"
        danger
        onConfirm={turnOff}
        onClose={() => setConfirmOff(false)}
      />
    </>
  )
}

function EmailMethod({ email, on, onChanged }: { email: string; on: boolean; onChanged: () => void }) {
  const toast = useToast()
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)
  const [confirmOff, setConfirmOff] = useState(false)

  useEffect(() => {
    if (cooldown <= 0) return
    const id = window.setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => window.clearTimeout(id)
  }, [cooldown])

  const send = async () => {
    await sendEmailStepCode(email)
    setCooldown(60)
  }

  const start = async () => {
    setBusy(true)
    setError(null)
    try {
      await send()
      setSent(true)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const verify = async (code: string) => {
    await verifyEmailStepCode(email, code)
    await setEmailStep(true)
    toast.show('Email code is on')
    onChanged()
  }

  const turnOff = async () => {
    await setEmailStep(false)
    toast.show('Email code is off')
    onChanged()
  }

  if (sent) {
    return (
      <GlassPanel padded>
        <CodeForm
          email={email}
          intro="Confirm it is you. We sent a code to"
          submitLabel="Turn on"
          onVerify={verify}
          onResend={async () => { try { await send(); toast.show('New code sent') } catch (e) { toast.error(errorMessage(e)) } }}
          cooldown={cooldown}
        />
      </GlassPanel>
    )
  }

  return (
    <>
      {error ? <ErrorBanner>{error}</ErrorBanner> : null}
      <GlassPanel padded className="col">
        <div className="row"><Mail size={22} aria-hidden /><strong>Email code is {on ? 'ON' : 'OFF'}</strong></div>
        <p className="small muted">After your password, we send a code to <strong>{email}</strong> and ask for it before opening the app.</p>
        <div>
          {on ? <Button variant="glass" onClick={() => setConfirmOff(true)}>Turn off</Button> : <Button variant="primary" loading={busy} onClick={() => void start()}>Set up</Button>}
        </div>
      </GlassPanel>
      <ConfirmDialog
        open={confirmOff}
        title="Turn off email code?"
        message="Logging in will no longer ask for an emailed code."
        confirmLabel="Turn off"
        danger
        onConfirm={turnOff}
        onClose={() => setConfirmOff(false)}
      />
    </>
  )
}
