import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { pushAvailable } from '@/lib/push'
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

  useEffect(() => {
    void notificationPermission().then(setPerm)
  }, [])

  const enable = async () => {
    const p = await requestNotificationPermission((url) => navigate(url))
    setPerm(p)
    if (p === 'granted') {
      toast.show('Notifications are on')
      if (!native) await showSystemNotification('iConnecto', 'Notifications are working 🎉', 'test')
    } else if (p === 'denied') toast.error('Notifications are blocked. Turn them on in your phone settings for this app.')
  }

  return (
    <GlassPanel padded className="col">
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <Bell size={22} color="var(--accent)" aria-hidden style={{ flex: 'none', marginTop: 2 }} />
        <div className="grow">
          <strong>Phone notifications</strong>
          <p className="small muted" style={{ margin: '4px 0 0' }}>
            {perm === 'granted'
              ? native
                ? 'On. You get alerts for messages, calls, likes, comments and new followers, even when the app is closed.'
                : 'On. You get alerts for new messages, likes, comments and followers while this page is open in the background.'
              : perm === 'denied'
                ? 'Blocked. Turn notifications on for iConnecto in your phone settings.'
                : perm === 'unsupported'
                  ? 'This version of the app or browser cannot show notifications.'
                  : 'Get an alert for new messages, likes, comments and followers.'}
          </p>
          {native ? null : (
            <p className="small faint" style={{ margin: '6px 0 0' }}>
              In a browser, alerts only work while the page is still running. Install the Android app to get them when it is closed.
            </p>
          )}
        </div>
      </div>
      {perm === 'default' ? (
        <div className="form-actions"><Button variant="primary" onClick={() => void enable()}>Turn on notifications</Button></div>
      ) : perm === 'granted' && !native ? (
        <div className="form-actions"><Button variant="glass" onClick={() => void showSystemNotification('iConnecto', 'Test notification 🔔', 'test')}>Send a test</Button></div>
      ) : null}
    </GlassPanel>
  )
}
