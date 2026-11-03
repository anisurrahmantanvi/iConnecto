import { useEffect, useState } from 'react'
import { useMe } from '@/app/AuthProvider'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { ErrorState, ListSkeleton } from '@/components/ui/Feedback'
import { PageHeader } from '@/components/ui/PageHeader'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/lib/supabase'
import { getNotifPrefs, NOT_INSTALLED, saveNotifPrefs, type NotifPrefs } from '@/services/settingsData'

const ROWS: { key: keyof NotifPrefs; label: string; hint: string }[] = [
  { key: 'push_messages', label: 'Messages', hint: 'New chat messages' },
  { key: 'push_calls', label: 'Calls', hint: 'Incoming voice and video calls' },
  { key: 'push_likes', label: 'Likes', hint: 'Likes on your posts' },
  { key: 'push_comments', label: 'Comments', hint: 'Comments and replies' },
  { key: 'push_social', label: 'Friends & followers', hint: 'Friend requests, new followers, community joins' },
]

const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const fromTime = (v: string) => { const [h, m] = v.split(':').map(Number); return (h || 0) * 60 + (m || 0) }

export default function NotificationPrefsPage() {
  const me = useMe()
  const toast = useToast()
  const [prefs, setPrefs] = useState<NotifPrefs | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading')

  useEffect(() => {
    let off = false
    getNotifPrefs(me.id).then((p) => { if (off) return; if (!p) setState('missing'); else { setPrefs(p); setState('ready') } }).catch(() => !off && setState('error'))
    return () => { off = true }
  }, [me.id])

  const paused = !!prefs?.paused_until && new Date(prefs.paused_until).getTime() > Date.now()

  const toggle = async (key: keyof NotifPrefs, value: boolean | number | string | null) => {
    if (!prefs) return
    const before = prefs
    setPrefs({ ...prefs, [key]: value })
    try { await saveNotifPrefs(me.id, { [key]: value }) } catch (e) { setPrefs(before); toast.error(errorMessage(e)) }
  }

  return (
    <>
      <PageHeader title="Notification Preferences" back="/settings/section/notifications" />
      <div className="stack">
        {state === 'loading' ? <ListSkeleton rows={4} /> : null}
        {state === 'error' ? <ErrorState message="Could not load your preferences." /> : null}
        {state === 'missing' ? <GlassPanel padded><p className="small muted">{NOT_INSTALLED}</p></GlassPanel> : null}
        {state === 'ready' && prefs ? (
          <>
            <GlassPanel className="settings-list">
              {ROWS.map((r) => (
                <div key={r.key} className="list-row">
                  <span className="grow"><strong style={{ display: 'block' }}>{r.label}</strong><span className="small muted">{r.hint}</span></span>
                  <span className="switch"><input type="checkbox" role="switch" aria-label={r.label} checked={prefs[r.key] as boolean} onChange={(e) => void toggle(r.key, e.target.checked)} /><span className="switch__track" aria-hidden /></span>
                </div>
              ))}
            </GlassPanel>
            <h2 className="section-title">Pause notifications</h2>
            <GlassPanel className="settings-list">
              {paused ? (
                <div className="list-row">
                  <span className="grow"><strong style={{ display: 'block' }}>Paused</strong><span className="small muted">Until {new Date(prefs.paused_until as string).toLocaleString()}</span></span>
                  <button type="button" className="link-btn" onClick={() => void toggle('paused_until', null)}>Resume</button>
                </div>
              ) : (
                <div className="list-row" style={{ flexWrap: 'wrap', gap: 8 }}>
                  <span className="grow"><strong style={{ display: 'block' }}>Pause phone alerts</strong><span className="small muted">Security alerts still come through</span></span>
                  {[1, 8, 24].map((h) => (
                    <button key={h} type="button" className="btn btn--glass btn--sm" onClick={() => void toggle('paused_until', new Date(Date.now() + h * 3600_000).toISOString())}>{h} h</button>
                  ))}
                </div>
              )}
            </GlassPanel>

            <h2 className="section-title">Quiet hours</h2>
            <GlassPanel className="settings-list">
              <div className="list-row">
                <span className="grow"><strong style={{ display: 'block' }}>Quiet hours</strong><span className="small muted">No phone alerts during this time</span></span>
                <span className="switch"><input type="checkbox" role="switch" aria-label="Quiet hours" checked={prefs.quiet_enabled} onChange={(e) => void toggle('quiet_enabled', e.target.checked)} /><span className="switch__track" aria-hidden /></span>
              </div>
              {prefs.quiet_enabled ? (
                <div className="list-row" style={{ gap: 12 }}>
                  <label className="grow small">From <input type="time" className="input" value={toTime(prefs.quiet_start)} onChange={(e) => void toggle('quiet_start', fromTime(e.target.value))} /></label>
                  <label className="grow small">To <input type="time" className="input" value={toTime(prefs.quiet_end)} onChange={(e) => void toggle('quiet_end', fromTime(e.target.value))} /></label>
                </div>
              ) : null}
            </GlassPanel>
            <p className="small faint" style={{ padding: '0 16px' }}>Security alerts about new sign-ins are always sent. These choices control phone alerts; you will still see everything inside the app.</p>
          </>
        ) : null}
      </div>
    </>
  )
}
