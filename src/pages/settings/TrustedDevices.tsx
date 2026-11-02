import { useState } from 'react'
import { Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState, Spinner } from '@/components/ui/Feedback'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { PageHeader } from '@/components/ui/PageHeader'
import { useToast } from '@/components/ui/Toast'
import { useAsync } from '@/hooks/common'
import { timeAgo } from '@/lib/format'
import { deviceKey, listDevices, signOutOthersAndForget } from '@/services/security'

/** Devices that have signed in to this account, with a way to sign every other one out. */
export default function TrustedDevicesPage() {
  const toast = useToast()
  const { data, loading, reload } = useAsync(listDevices, [])
  const [confirm, setConfirm] = useState(false)
  const mine = deviceKey()

  const signOutOthers = async () => {
    await signOutOthersAndForget()
    toast.show('Signed out of your other devices')
    reload()
  }

  return (
    <>
      <PageHeader title="Trusted Devices" back="/settings/section/advanced-account-protection" />
      <div className="stack">
        {loading ? <Spinner label="Loading" /> : null}
        {!loading && data === null ? (
          <GlassPanel padded><p className="small muted">The device list will be available after the next database update.</p></GlassPanel>
        ) : null}
        {data && !data.length ? <EmptyState icon={<Smartphone size={28} />} title="No devices yet" body="Devices appear here the next time you open the app." /> : null}
        {data && data.length ? (
          <GlassPanel className="settings-list" as="nav" aria-label="Devices">
            {data.map((d) => (
              <div key={d.id} className="list-row">
                <Smartphone size={20} aria-hidden />
                <span className="grow">
                  <strong style={{ display: 'block' }}>{d.label}{d.device_key === mine ? ' (this device)' : ''}</strong>
                  <span className="small muted">Last active {timeAgo(d.last_seen)}</span>
                </span>
              </div>
            ))}
          </GlassPanel>
        ) : null}
        <GlassPanel padded className="col">
          <p className="small muted">Don't recognise a device? Sign out everywhere else, then change your password.</p>
          <div><Button variant="glass" onClick={() => setConfirm(true)}>Sign out other devices</Button></div>
        </GlassPanel>
      </div>
      <ConfirmDialog
        open={confirm}
        title="Sign out other devices?"
        message="Every device except this one will be logged out."
        confirmLabel="Sign out"
        danger
        onConfirm={signOutOthers}
        onClose={() => setConfirm(false)}
      />
    </>
  )
}
