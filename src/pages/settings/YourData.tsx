import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, Share2 } from 'lucide-react'
import { useMe } from '@/app/AuthProvider'
import { Button } from '@/components/ui/Button'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { PageHeader } from '@/components/ui/PageHeader'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/lib/supabase'
import { collectMyData } from '@/services/settingsData'

export default function YourDataPage() {
  const me = useMe()
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  const build = async () => {
    const data = await collectMyData(me.id)
    return new File([JSON.stringify(data, null, 2)], `iconnecto-${me.username}-data.json`, { type: 'application/json' })
  }

  const download = async () => {
    setBusy(true)
    try {
      const file = await build()
      const url = URL.createObjectURL(file)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10000)
      toast.show('Your data file is ready')
    } catch (e) { toast.error(errorMessage(e)) } finally { setBusy(false) }
  }

  // Some phone web views cannot save downloads, so sharing the file is offered as a second way.
  const share = async () => {
    setBusy(true)
    try {
      const file = await build()
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'My iConnecto data' })
      else toast.error('Sharing files is not supported here. Try Download.')
    } catch (e) { if ((e as Error).name !== 'AbortError') toast.error(errorMessage(e)) } finally { setBusy(false) }
  }

  return (
    <>
      <PageHeader title="Your Information" back />
      <div className="stack">
        <h2 className="section-title">Download your information</h2>
        <GlassPanel padded>
          <div className="stack">
            <p className="muted">A file with your profile, posts, comments, likes, saved posts and friends list. Messages and other people's data are not included.</p>
            <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
              <Button variant="primary" icon={<Download size={16} />} loading={busy} onClick={() => void download()}>Download</Button>
              <Button variant="glass" icon={<Share2 size={16} />} disabled={busy} onClick={() => void share()}>Share file</Button>
            </div>
          </div>
        </GlassPanel>
        <h2 className="section-title">Manage</h2>
        <GlassPanel className="settings-list">
          <Link to="/settings/media" className="list-row list-row--link">Manage uploaded media</Link>
          <Link to="/settings/deactivate" className="list-row list-row--link">Account deactivation</Link>
          <Link to="/settings/account" className="list-row list-row--link">Delete account</Link>
        </GlassPanel>
      </div>
    </>
  )
}
