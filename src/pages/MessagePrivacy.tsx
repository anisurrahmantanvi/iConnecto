import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMe } from '@/app/AuthProvider'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { PageHeader } from '@/components/ui/PageHeader'
import { Switch } from '@/components/ui/Switch'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/lib/supabase'
import { getChatPrivacy, setChatPrivacy, type ChatPrivacyPrefs } from '@/services/chatPrefs'
import { getMyShowActivity, setMyShowActivity } from '@/services/presence'

/** Read receipts, typing status, online status and who can message you, in one place. */
export default function MessagePrivacyPage() {
  const me = useMe()
  const toast = useToast()
  const [prefs, setPrefs] = useState<ChatPrivacyPrefs | null>(null)
  const [online, setOnline] = useState<boolean | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    void Promise.all([getChatPrivacy(me.id), getMyShowActivity(me.id)]).then(([p, o]) => {
      setPrefs(p)
      setOnline(o)
      setLoaded(true)
    })
  }, [me.id])

  const change = async (patch: Partial<ChatPrivacyPrefs>) => {
    const before = prefs
    setPrefs((p) => (p ? { ...p, ...patch } : p))
    try {
      await setChatPrivacy(me.id, patch)
    } catch (e) {
      setPrefs(before)
      toast.error(errorMessage(e))
    }
  }
  const changeOnline = async (on: boolean) => {
    const before = online
    setOnline(on)
    try {
      await setMyShowActivity(me.id, on)
    } catch (e) {
      setOnline(before)
      toast.error(errorMessage(e))
    }
  }

  return (
    <>
      <PageHeader title="Message privacy" back="/message-settings" />
      <div className="stack">
        {prefs ? (
          <GlassPanel padded className="col">
            <Switch
              label="Read receipts"
              description="Show “Seen” under your messages once they are read. If you turn it off, you will not see “Seen” on theirs either."
              checked={prefs.read_receipts}
              onChange={(e) => void change({ read_receipts: e.target.checked })}
            />
            <Switch
              label="Typing status"
              description="Show “typing…” while you write. If you turn it off, you will not see it from others either."
              checked={prefs.typing_status}
              onChange={(e) => void change({ typing_status: e.target.checked })}
            />
          </GlassPanel>
        ) : loaded ? (
          <GlassPanel padded><p className="small muted">Read receipts and typing status will be available after the next database update.</p></GlassPanel>
        ) : null}

        {online !== null ? (
          <GlassPanel padded className="col">
            <Switch
              label="Online status"
              description="Show when you are online or were last active. If you turn it off, you will not see other people's status either."
              checked={online}
              onChange={(e) => void changeOnline(e.target.checked)}
            />
          </GlassPanel>
        ) : null}

        <GlassPanel padded className="col">
          <strong>Who can message you</strong>
          <p className="small muted">Choose who can start a chat with you.</p>
          <Link to="/settings/privacy" className="btn btn--glass btn--sm" style={{ alignSelf: 'flex-start' }}>Open</Link>
        </GlassPanel>
      </div>
    </>
  )
}
