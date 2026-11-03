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

  const toggle = async (key: keyof NotifPrefs, value: boolean) => {
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
            <p className="small faint" style={{ padding: '0 16px' }}>Security alerts about new sign-ins are always sent. These choices control phone alerts; you will still see everything inside the app.</p>
          </>
        ) : null}
      </div>
    </>
  )
}
