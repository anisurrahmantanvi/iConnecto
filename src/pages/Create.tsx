import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ImagePlus, X } from 'lucide-react'
import { useMe } from '@/app/AuthProvider'
import { Avatar } from '@/components/ui/Avatar'
import { Button, IconButton } from '@/components/ui/Button'
import { EmojiButton } from '@/components/ui/EmojiButton'
import { ErrorBanner } from '@/components/ui/Feedback'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { PageHeader } from '@/components/ui/PageHeader'
import { useToast } from '@/components/ui/Toast'
import { useAsync } from '@/hooks/common'
import { insertAtCaret, restoreCaret, useAutosize } from '@/hooks/ui'
import { validateImage } from '@/lib/image'
import { errorMessage } from '@/lib/supabase'
import { myCommunities } from '@/services/communities'
import { createPost, MAX_POST_IMAGES, MAX_POST_LENGTH } from '@/services/posts'
import type { PostVisibility } from '@/types/db'

const MAX_ORIGINAL_BYTES = 20 * 1024 * 1024 // the service compresses, then enforces the real 5 MB limit

export default function CreatePage() {
  const me = useMe()
  const navigate = useNavigate()
  const toast = useToast()
  const [params] = useSearchParams()
  const wantedCommunity = params.get('community') ?? ''

  const [text, setText] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [communityId, setCommunityId] = useState('')
  const [visibility, setVisibility] = useState<PostVisibility>('public')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const area = useRef<HTMLTextAreaElement>(null)
  const picker = useRef<HTMLInputElement>(null)

  const communities = useAsync(() => myCommunities(me.id), [me.id])
  useAutosize(area, text, 320)

  // Preselect the community from ?community=… once we know the user really belongs to it.
  useEffect(() => {
    if (!wantedCommunity || !communities.data) return
    if (communities.data.some((c) => c.id === wantedCommunity)) setCommunityId(wantedCommunity)
  }, [wantedCommunity, communities.data])

  // Object URLs are created in an effect (and revoked in its cleanup) so React StrictMode's double-run stays safe.
  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f))
    setPreviews(urls)
    return () => urls.forEach((u) => URL.revokeObjectURL(u))
  }, [files])

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? [])
    e.target.value = ''
    const next = [...files]
    for (const f of picked) {
      if (next.length >= MAX_POST_IMAGES) {
        toast.error(`You can attach up to ${MAX_POST_IMAGES} photos.`)
        break
      }
      const problem = validateImage(f, { maxBytes: MAX_ORIGINAL_BYTES })
      if (problem) {
        toast.error(`${f.name}: ${problem}`)
        continue
      }
      next.push(f)
    }
    setFiles(next)
  }

  const canPost = (text.trim().length > 0 || files.length > 0) && text.length <= MAX_POST_LENGTH && !busy

  const submit = async () => {
    if (!canPost) return
    setBusy(true)
    setError(null)
    try {
      const id = await createPost(me.id, { content: text, files, communityId: communityId || null, visibility })
      navigate(`/p/${id}`, { replace: true })
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="New post" back />
      <GlassPanel padded className="col">
        {error ? <ErrorBanner>{error}</ErrorBanner> : null}

        <div className="row" style={{ alignItems: 'flex-start' }}>
          <Avatar src={me.avatar_url} name={me.display_name ?? me.username} />
          <textarea
            ref={area}
            className="textarea grow"
            aria-label="Post text"
            placeholder="What's on your mind?"
            maxLength={MAX_POST_LENGTH}
            rows={3}
            value={text}
            disabled={busy}
            onChange={(e) => setText(e.target.value)}
          />
        </div>

        {previews.length ? (
          <div className="upload-grid" aria-label="Attached photos">
            {previews.map((src, i) => (
              <div className="thumb" key={src}>
                <img src={src} alt={`Attachment ${i + 1}`} />
                <button type="button" aria-label={`Remove photo ${i + 1}`} disabled={busy} onClick={() => setFiles((fs) => fs.filter((_, j) => j !== i))}>
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {communities.data && communities.data.length ? (
          <div className="field">
            <label htmlFor="post-audience">Post to</label>
            <select id="post-audience" className="input" value={communityId} disabled={busy} onChange={(e) => setCommunityId(e.target.value)}>
              <option value="">Everyone (public feed)</option>
              {communities.data.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        ) : null}

        {!communityId ? (
          <div className="field">
            <label htmlFor="post-privacy">Who can see this post?</label>
            <select id="post-privacy" className="input" value={visibility} disabled={busy} onChange={(e) => setVisibility(e.target.value as PostVisibility)}>
              <option value="public">Public (everyone)</option>
              <option value="followers">Followers only</option>
              <option value="only_me">Only me</option>
            </select>
          </div>
        ) : null}

        <div className="row">
          <IconButton label="Add photos" disabled={busy || files.length >= MAX_POST_IMAGES} onClick={() => picker.current?.click()}>
            <ImagePlus size={22} />
          </IconButton>
          <EmojiButton
            onPick={(emoji) => {
              const r = insertAtCaret(area.current, text, emoji, MAX_POST_LENGTH)
              setText(r.value)
              restoreCaret(area.current, r.caret)
            }}
          />
          <input
            ref={picker}
            className="file-hidden"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            tabIndex={-1}
            aria-hidden
            onChange={onPick}
          />
          <span className="spacer" />
          <span className={`small ${text.length > MAX_POST_LENGTH * 0.9 ? '' : 'faint'}`} aria-live="polite">
            {text.length}/{MAX_POST_LENGTH}
          </span>
          <Button variant="primary" loading={busy} disabled={!canPost} onClick={() => void submit()}>
            {busy && files.length ? 'Uploading…' : 'Post'}
          </Button>
        </div>
      </GlassPanel>
    </>
  )
}
