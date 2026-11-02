import { useEffect, useState } from 'react'
import { useMe } from '@/app/AuthProvider'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { PageHeader } from '@/components/ui/PageHeader'
import { Switch } from '@/components/ui/Switch'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/lib/supabase'
import { getSecurityAlerts, setSecurityAlerts } from '@/services/security'

export default function SecurityAlertsPage() {
  const me = useMe()
  const toast = useToast()
  const [on, setOn] = useState<boolean | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    void getSecurityAlerts(me.id).then((v) => { setOn(v); setLoaded(true) })
  }, [me.id])

  const change = async (next: boolean) => {
    const before = on
    setOn(next)
    try {
      await setSecurityAlerts(me.id, next)
    } catch (e) {
      setOn(before)
      toast.error(errorMessage(e))
    }
  }

  return (
    <>
      <PageHeader title="Security Alerts" back="/settings/section/advanced-account-protection" />
      <div className="stack">
        {on !== null ? (
          <GlassPanel padded className="col">
            <Switch
              label="Alert me about new devices"
              description="Get a notification when your account is opened on a device you have not used before."
              checked={on}
              onChange={(e) => void change(e.target.checked)}
            />
          </GlassPanel>
        ) : loaded ? (
          <GlassPanel padded><p className="small muted">Security alerts will be available after the next database update.</p></GlassPanel>
        ) : null}
      </div>
    </>
  )
}
