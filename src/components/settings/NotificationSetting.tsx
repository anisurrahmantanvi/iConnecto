import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { enablePush, pushAvailable, pushStatus } from '@/lib/push'
import { Button } from '@/components/ui/Button'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { useToast } from '@/components/ui/Toast'
import { notificationPermission, requestNotificationPermission, showSystemNotification, type NotifyPermission } from '@/lib/systemNotify'

/** Turn phone notifications on and send a test one. */
export function NotificationSetting() {
  const toast = useToast()
  const navigate = useNavigate()
  const native = pushAvailable()
  const [perm, setPerm] = useState<NotifyPermission | null>(null)
  const [trail, setTrail] = useState<string[]>([])
  const refresh = () => setTrail(pushStatus())

  useEffect(() => {
    void notificationPermission().then(setPerm)
    refresh()
    const id = window.setInterval(refresh, 1500)
    const ok = perm === 'granted'
  const lines = trail.filter((t) => /fail|error|denied/i.test(t))
  const trouble = native && ok && lines.length > 0

  return (
    <GlassPanel padded className="col">
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <Bell size={22} color="var(--accent)" aria-hidden style={{ flex: 'none', marginTop: 2 }} />
        <div className="grow">
          <strong>Notifications</strong>
          <p className="small muted" style={{ margin: '4px 0 0' }}>
            {ok
              ? trouble
                ? 'Notifications are allowed, but this phone could not be set up to receive them.'
                : native
                  ? 'You are all set. You will get alerts for messages, calls, likes, comments and new followers, even when the app is closed.'
                  : 'You will get alerts for messages, likes, comments and new followers while this page stays open in the background.'
              : perm === 'denied'
                ? 'Notifications are turned off. Open your phone Settings, find iConnecto and allow notifications.'
                : perm === 'unsupported'
                  ? 'This phone or browser cannot show notifications.'
                  : 'Get an alert for messages, calls, likes, comments and new followers.'}
          </p>
          {native ? null : (
            <p className="small faint" style={{ margin: '6px 0 0' }}>
              Browser alerts only work while the page is running. Install the Android app to get them when it is closed.
            </p>
          )}
          {trouble ? (
            <p className="small faint" style={{ margin: '6px 0 0' }}>{lines[lines.length - 1]}</p>
          ) : null}
        </div>
      </div>
      {perm === 'default' ? (
        <div className="form-actions"><Button variant="primary" onClick={() => void enable()}>Turn on notifications</Button></div>
      ) : trouble ? (
        <div className="form-actions"><Button variant="glass" onClick={() => { void enablePush((url) => navigate(url)).catch(() => undefined); window.setTimeout(refresh, 1500) }}>Try again</Button></div>
      ) : ok && !native ? (
        <div className="form-actions"><Button variant="glass" onClick={() => void showSystemNotification('iConnecto', 'Test notification 🔔', 'test')}>Send a test</Button></div>
      ) : null}
    </GlassPanel>
  )
}
