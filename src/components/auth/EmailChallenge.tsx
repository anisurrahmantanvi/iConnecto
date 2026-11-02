import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/app/AuthProvider'
import { CodeForm } from '@/components/auth/CodeForm'
import { Button } from '@/components/ui/Button'
import { ErrorBanner } from '@/components/ui/Feedback'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { errorMessage } from '@/lib/supabase'
import { sendEmailStepCode, verifyEmailStepCode } from '@/services/security'

/** Second login step: a code sent to the account's email. */
export function EmailChallenge({ email, onDone }: { email: string; onDone: () => void }) {
  const { signOut } = useAuth()
  const [cooldown, setCooldown] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const sent = useRef(false)

  const send = async () => {
    setError(null)
    try {
      await sendEmailStepCode(email)
      setCooldown(60)
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  useEffect(() => {
    if (sent.current) return
    sent.current = true
    void send()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (cooldown <= 0) return
    const id = window.setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => window.clearTimeout(id)
  }, [cooldown])

  return (
    <div className="auth">
      <GlassPanel className="auth__card">
        {error ? <ErrorBanner>{error}</ErrorBanner> : null}
        <CodeForm
          email={email}
          intro="Two-step verification. We sent a code to"
          submitLabel="Verify"
          onVerify={async (code) => { await verifyEmailStepCode(email, code); onDone() }}
          onResend={send}
          cooldown={cooldown}
        />
        <Button type="button" variant="ghost" block onClick={() => void signOut()}>Log out</Button>
      </GlassPanel>
    </div>
  )
}
