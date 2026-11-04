import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Film, X } from 'lucide-react'
import { useMe } from '@/app/AuthProvider'
import { Button } from '@/components/ui/Button'
import { TextAreaField } from '@/components/ui/Field'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { PageHeader } from '@/components/ui/PageHeader'
import { useToast } from '@/components/ui/Toast'
import { errorMessage } from '@/lib/supabase'
import { createReel, MAX_REEL_BYTES, MAX_REEL_SECONDS, validateVideo } from '@/services/reels'

export default function ReelCreatePage() {
  const me = useMe()
  const toast = useToast()
  const navigate = useNavigate()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!file) { setPreview(null); return }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const pick = (f: File | undefined) => {
    if (!f) return
    const bad = validateVideo(f)
    if (bad) { toast.error(bad); return }
    setFile(f)
  }

  const post = async () => {
    if (!file || busy) return
    setBusy(true)
    try {
      await createReel(me.id, file, caption)
      toast.show('Reel posted')
      navigate('/reels', { replace: true })
    } catch (e) { toast.error(errorMessage(e)); setBusy(false) }
  }

  return (
    <>
      <PageHeader title="New reel" back="/reels" />
      <div className="stack">
        <GlassPanel padded>
          <div className="stack">
            {preview ? (
              <div style={{ position: 'relative' }}>
                <video src={preview} controls playsInline muted style={{ width: '100%', maxHeight: '55dvh', borderRadius: 14, background: '#000' }} />
                <button type="button" aria-label="Remove video" disabled={busy} onClick={() => setFile(null)} className="icon-btn" style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,.55)', color: '#fff' }}><X size={18} /></button>
              </div>
            ) : (
              <>
                <label className="btn btn--primary" style={{ justifySelf: 'start' }}><Film size={16} aria-hidden /> Choose a video
                  <input type="file" accept="video/mp4,video/webm,video/quicktime" hidden onChange={(e) => pick(e.target.files?.[0])} />
                </label>
                <label className="btn btn--glass" style={{ justifySelf: 'start' }}>Record with camera
                  <input type="file" accept="video/*" capture="environment" hidden onChange={(e) => pick(e.target.files?.[0])} />
                </label>
                <p className="small muted">Up to {MAX_REEL_SECONDS} seconds and {Math.round(MAX_REEL_BYTES / 1048576)} MB. MP4, WebM or MOV. Vertical videos look best.</p>
              </>
            )}
            <TextAreaField label="Caption" rows={3} maxLength={300} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Say something about your reel (optional)" />
            <Button variant="primary" loading={busy} disabled={!file} onClick={() => void post()}>{busy ? 'Uploading…' : 'Post reel'}</Button>
            <p className="small faint">Reels are public. Only upload videos you have the right to share.</p>
          </div>
        </GlassPanel>
      </div>
    </>
  )
}
