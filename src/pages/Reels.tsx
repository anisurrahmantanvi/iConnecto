import { useEffect, useRef, useState } from 'react'
import { Clapperboard, ExternalLink, Plus, Trash2 } from 'lucide-react'
import type { Reel } from '@/types/db'
import { AddReelDialog } from '@/components/reels/AddReelDialog'
import { TikTokEmbed } from '@/components/reels/TikTokEmbed'
import { Button, IconButton } from '@/components/ui/Button'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/Feedback'
import { PageHeader } from '@/components/ui/PageHeader'
import { useToast } from '@/components/ui/Toast'
import { useAsync } from '@/hooks/common'
import { errorMessage } from '@/lib/supabase'
import { deleteReel, isAdmin, listReels } from '@/services/reels'

/** One reel. The TikTok player is only mounted while the card is near the screen, so a long list stays light. */
function ReelCard({ reel, admin, onRemove }: { reel: Reel; admin: boolean; onRemove: (r: Reel) => void }) {
  const ref = useRef<HTMLElement>(null)
  const [near, setNear] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => setNear(entry.isIntersecting), { rootMargin: '60% 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <article ref={ref} className="reel" aria-label={reel.title || 'TikTok video'}>
      {near ? (
        <TikTokEmbed reel={reel} />
      ) : (
        <div className="reel__placeholder">
          {reel.thumbnail_url ? <img src={reel.thumbnail_url} alt="" loading="lazy" /> : <Clapperboard size={40} aria-hidden />}
        </div>
      )}
      <div className="row reel__bar">
        <a className="small muted grow truncate" href={reel.tiktok_url} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={14} aria-hidden /> {reel.author_name ? `${reel.author_name} on TikTok` : 'Open on TikTok'}
        </a>
        {admin ? (
          <IconButton label="Remove from Reels" small onClick={() => onRemove(reel)}>
            <Trash2 size={18} />
          </IconButton>
        ) : null}
      </div>
    </article>
  )
}

export default function ReelsPage() {
  const toast = useToast()
  const feed = useAsync(listReels, [])
  const admin = useAsync(isAdmin, [])
  const [adding, setAdding] = useState(false)
  const isAdminUser = admin.data === true

  // Gentle snapping from one video to the next while this page is open.
  useEffect(() => {
    document.documentElement.classList.add('reels-snap')
    return () => document.documentElement.classList.remove('reels-snap')
  }, [])

  const remove = async (reel: Reel) => {
    if (!window.confirm('Remove this video from Reels?')) return
    try {
      await deleteReel(reel.id)
      feed.setData((prev) => (prev ? prev.filter((r) => r.id !== reel.id) : prev))
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <>
      <PageHeader
        title="Reels"
        actions={isAdminUser ? <IconButton label="Add a TikTok video" onClick={() => setAdding(true)}><Plus size={24} /></IconButton> : undefined}
      />

      {feed.loading && !feed.data ? (
        <ListSkeleton />
      ) : feed.error && !feed.data ? (
        <ErrorState message={feed.error} onRetry={feed.reload} />
      ) : !feed.data || !feed.data.length ? (
        <EmptyState
          icon={<Clapperboard size={28} />}
          title="No reels yet"
          body={isAdminUser ? 'Paste a TikTok video link to add the first one.' : 'New videos are added here regularly. Check back soon.'}
          action={isAdminUser ? <Button variant="primary" onClick={() => setAdding(true)}>Add a TikTok video</Button> : undefined}
        />
      ) : (
        <div className="reels">
          {feed.data.map((r) => (
            <ReelCard key={r.id} reel={r} admin={isAdminUser} onRemove={(x) => void remove(x)} />
          ))}
          <p className="small faint" style={{ textAlign: 'center' }}>Videos are played by TikTok and belong to their creators.</p>
        </div>
      )}

      <AddReelDialog open={adding} onClose={() => setAdding(false)} onAdded={(r) => feed.setData((prev) => [r, ...(prev ?? [])])} />
    </>
  )
}
