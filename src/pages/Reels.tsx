import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Clapperboard, Heart, MessageCircle, Plus, Send, Share2, Trash2, Volume2, VolumeX } from 'lucide-react'
import { useMe } from '@/app/AuthProvider'
import { Avatar } from '@/components/ui/Avatar'
import { IconButton } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Dialog } from '@/components/ui/Dialog'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/Feedback'
import { PageHeader } from '@/components/ui/PageHeader'
import { useToast } from '@/components/ui/Toast'
import { VerifiedBadge } from '@/components/ui/VerifiedBadge'
import { usePaged } from '@/hooks/common'
import { appUrl } from '@/lib/base'
import { compactNumber, timeAgo } from '@/lib/format'
import { errorMessage } from '@/lib/supabase'
import {
  addReelComment, countView, deleteReel, deleteReelComment, fetchReels, listReelComments, setReelLike,
  fetchReel, type Reel, type ReelComment,
} from '@/services/reels'

function Comments({ reel, onClose, onCount }: { reel: Reel; onClose: () => void; onCount: (d: number) => void }) {
  const me = useMe()
  const toast = useToast()
  const [items, setItems] = useState<ReelComment[] | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const load = useCallback(() => { void listReelComments(reel.id).then(setItems).catch((e) => toast.error(errorMessage(e))) }, [reel.id, toast])
  useEffect(load, [load])
  const send = async () => {
    if (!text.trim() || busy) return
    setBusy(true)
    try { await addReelComment(reel.id, text); setText(''); onCount(1); load() } catch (e) { toast.error(errorMessage(e)) } finally { setBusy(false) }
  }
  return (
    <Dialog open title="Comments" onClose={onClose}>
      <div className="col" style={{ gap: 10, maxHeight: '60dvh' }}>
        <div style={{ overflowY: 'auto', display: 'grid', gap: 10 }}>
          {items === null ? <ListSkeleton rows={2} /> : null}
          {items?.length === 0 ? <p className="muted small">No comments yet. Be the first.</p> : null}
          {items?.map((c) => (
            <div key={c.id} className="row" style={{ alignItems: 'flex-start', gap: 8 }}>
              <Avatar src={c.author?.avatar_url} name={c.author?.display_name ?? c.author?.username} size="sm" />
              <div className="grow">
                <strong className="small">{c.author?.display_name || c.author?.username}<VerifiedBadge badge={c.author?.badge} size={13} /></strong>
                <span className="small faint"> · {timeAgo(c.created_at)}</span>
                <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{c.content}</div>
              </div>
              {c.author_id === me.id || reel.author_id === me.id ? (
                <IconButton label="Delete comment" onClick={() => void deleteReelComment(c.id).then(() => { onCount(-1); load() }).catch((e) => toast.error(errorMessage(e)))}><Trash2 size={16} /></IconButton>
              ) : null}
            </div>
          ))}
        </div>
        <div className="row" style={{ gap: 8 }}>
          <input className="input grow" placeholder="Write a comment…" maxLength={500} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void send() }} />
          <IconButton label="Send" disabled={busy || !text.trim()} onClick={() => void send()}><Send size={20} /></IconButton>
        </div>
      </div>
    </Dialog>
  )
}

export function ReelItem({ reel, muted, onToggleMute, patch, onDeleted }: { reel: Reel; muted: boolean; onToggleMute: () => void; patch: (r: Reel) => void; onDeleted: () => void }) {
  const me = useMe()
  const toast = useToast()
  const box = useRef<HTMLElement>(null)
  const vid = useRef<HTMLVideoElement>(null)
  const counted = useRef(false)
  const [openComments, setOpenComments] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const a = reel.author

  useEffect(() => {
    const el = box.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => {
      const v = vid.current
      if (!v) return
      if (e.isIntersecting && e.intersectionRatio >= 0.6) {
        void v.play().catch(() => undefined)
        if (!counted.current) { counted.current = true; countView(reel.id) }
      } else v.pause()
    }, { threshold: [0, 0.6, 1] })
    io.observe(el)
    return () => io.disconnect()
  }, [reel.id])

  const like = async () => {
    const on = !reel.liked
    patch({ ...reel, liked: on, like_count: Math.max(0, reel.like_count + (on ? 1 : -1)) })
    try { await setReelLike(reel.id, me.id, on) } catch (e) { patch(reel); toast.error(errorMessage(e)) }
  }
  const share = async () => {
    const url = appUrl('/reels')
    try {
      if (navigator.share) await navigator.share({ title: 'iConnecto Reel', text: reel.caption || 'Watch this reel on iConnecto', url })
      else { await navigator.clipboard.writeText(url); toast.show('Link copied') }
    } catch { /* cancelled */ }
  }

  return (
    <section ref={box} className="reel" aria-label={`Reel by ${a?.display_name ?? a?.username ?? 'unknown'}`}>
      <video ref={vid} className="reel__video" src={reel.video_url} loop muted={muted} playsInline preload="metadata" onClick={onToggleMute} />
      <div className="reel__side">
        <button type="button" className={`reel__btn ${reel.liked ? 'is-on' : ''}`} aria-label={reel.liked ? 'Unlike' : 'Like'} aria-pressed={reel.liked} onClick={() => void like()}><Heart size={28} fill={reel.liked ? 'currentColor' : 'none'} /><span>{compactNumber(reel.like_count)}</span></button>
        <button type="button" className="reel__btn" aria-label="Comments" onClick={() => setOpenComments(true)}><MessageCircle size={28} /><span>{compactNumber(reel.comment_count)}</span></button>
        <button type="button" className="reel__btn" aria-label="Share" onClick={() => void share()}><Share2 size={26} /></button>
        <button type="button" className="reel__btn" aria-label={muted ? 'Sound on' : 'Sound off'} onClick={onToggleMute}>{muted ? <VolumeX size={24} /> : <Volume2 size={24} />}</button>
        {reel.author_id === me.id ? <button type="button" className="reel__btn" aria-label="Delete reel" onClick={() => setConfirm(true)}><Trash2 size={24} /></button> : null}
      </div>
      <div className="reel__info">
        <Link to={a ? `/u/${a.username}` : '#'} className="row" style={{ gap: 8, color: 'inherit' }}>
          <Avatar src={a?.avatar_url} name={a?.display_name ?? a?.username} size="sm" />
          <strong>{a?.display_name || a?.username || 'Deleted user'}<VerifiedBadge badge={a?.badge} size={14} /></strong>
        </Link>
        {reel.caption ? <p className="reel__caption">{reel.caption}</p> : null}
        <span className="small" style={{ opacity: 0.8 }}>{compactNumber(reel.view_count)} views · {timeAgo(reel.created_at)}</span>
      </div>
      {openComments ? <Comments reel={reel} onClose={() => setOpenComments(false)} onCount={(d) => patch({ ...reel, comment_count: Math.max(0, reel.comment_count + d) })} /> : null}
      <ConfirmDialog open={confirm} title="Delete this reel?" message="This can't be undone." confirmLabel="Delete" danger onClose={() => setConfirm(false)} onConfirm={async () => { await deleteReel(reel); onDeleted() }} />
    </section>
  )
}

export default function ReelsPage() {
  const me = useMe()
  const navigate = useNavigate()
  const fetchPage = useCallback((cursor: string | null) => fetchReels(me.id, cursor), [me.id])
  const { items, loading, error, hasMore, loadMore, reload, setItems } = usePaged(fetchPage)
  const [muted, setMuted] = useState(true)
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = end.current
    if (!el || !hasMore) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) loadMore() }, { rootMargin: '600px' })
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore, loadMore, items.length])

  return (
    <>
      <PageHeader title="Reels" actions={<IconButton label="Create reel" onClick={() => navigate('/reels/new')}><Plus size={22} /></IconButton>} />
      {loading ? <ListSkeleton rows={2} /> : null}
      {error ? <ErrorState message={error} onRetry={reload} /> : null}
      {!loading && !error && !items.length ? (
        <EmptyState icon={<Clapperboard size={28} />} title="No reels yet" body="Be the first to share a short video." action={<Link to="/reels/new" className="btn btn--primary">Create a reel</Link>} />
      ) : null}
      {items.length ? (
        <div className="reels">
          {items.map((r) => (
            <ReelItem key={r.id} reel={r} muted={muted} onToggleMute={() => setMuted((m) => !m)}
              patch={(n) => setItems((prev) => prev.map((x) => (x.id === n.id ? n : x)))}
              onDeleted={() => setItems((prev) => prev.filter((x) => x.id !== r.id))} />
          ))}
          <div ref={end} style={{ height: 1 }} />
        </div>
      ) : null}
    </>
  )
}

/** One reel opened from a profile or the home strip. */
export function ReelPlayerPage() {
  const { id = '' } = useParams()
  const me = useMe()
  const navigate = useNavigate()
  const [reel, setReel] = useState<Reel | null | undefined>(undefined)
  const [err, setErr] = useState<string | null>(null)
  const [muted, setMuted] = useState(false)
  useEffect(() => { void fetchReel(me.id, id).then(setReel).catch((e) => setErr(errorMessage(e))) }, [id, me.id])
  return (
    <>
      <PageHeader title="Reel" back="/reels" />
      {err ? <ErrorState message={err} /> : null}
      {reel === undefined && !err ? <ListSkeleton rows={2} /> : null}
      {reel === null ? <EmptyState icon={<Clapperboard size={28} />} title="Reel not found" body="It may have been deleted." action={<Link to="/reels" className="btn btn--primary">Watch reels</Link>} /> : null}
      {reel ? (
        <div className="reels">
          <ReelItem reel={reel} muted={muted} onToggleMute={() => setMuted((m) => !m)} patch={setReel as (r: Reel) => void} onDeleted={() => navigate('/reels', { replace: true })} />
        </div>
      ) : null}
    </>
  )
}
