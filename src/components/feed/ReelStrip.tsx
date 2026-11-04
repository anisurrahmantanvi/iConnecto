import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Clapperboard, Play } from 'lucide-react'
import { fetchReelStrip } from '@/services/reels'

type Item = Awaited<ReturnType<typeof fetchReelStrip>>[number]

/** Horizontal row of reel thumbnails (the first frame of each video). Renders nothing when there are no reels. */
export function ReelStrip({ authorId = null, title = 'Reels' }: { authorId?: string | null; title?: string }) {
  const [items, setItems] = useState<Item[]>([])
  useEffect(() => {
    let off = false
    void fetchReelStrip(authorId).then((r) => !off && setItems(r))
    return () => { off = true }
  }, [authorId])
  if (!items.length) return null
  return (
    <section className="glass" style={{ padding: '10px 0 12px', borderRadius: 0 }} aria-label={title}>
      <div className="row" style={{ padding: '0 14px 8px' }}>
        <strong className="grow row" style={{ gap: 6 }}><Clapperboard size={18} aria-hidden /> {title}</strong>
        <Link to="/reels" className="small">See all</Link>
      </div>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '0 14px', scrollSnapType: 'x proximity' }}>
        {items.map((r) => (
          <Link key={r.id} to={`/reels/${r.id}`} aria-label={r.caption || 'Open reel'} style={{ position: 'relative', flex: 'none', width: 108, aspectRatio: '9 / 16', borderRadius: 12, overflow: 'hidden', background: '#000', scrollSnapAlign: 'start' }}>
            <video src={`${r.video_url}#t=0.1`} preload="metadata" muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
            <span style={{ position: 'absolute', left: 6, bottom: 6, color: '#fff', fontSize: 12, display: 'flex', alignItems: 'center', gap: 3, textShadow: '0 1px 3px rgba(0,0,0,.8)' }}><Play size={12} fill="#fff" /> {r.view_count}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
