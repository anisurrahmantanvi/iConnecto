import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Heart, MessageCircle } from 'lucide-react'
import { useMe } from '@/app/AuthProvider'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/Feedback'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { PageHeader } from '@/components/ui/PageHeader'
import { useAsync } from '@/hooks/common'
import { timeAgo } from '@/lib/format'
import { supabase } from '@/lib/supabase'

type Tab = 'posts' | 'comments' | 'likes'
interface Item { key: string; postId: string; text: string; at: string }

const clip = (s: string | null | undefined) => {
  const t = (s ?? '').replace(/\s+/g, ' ').trim()
  return t.length > 140 ? t.slice(0, 140) + '…' : t || '(photo or media)'
}

async function load(tab: Tab, me: string): Promise<Item[]> {
  if (tab === 'posts') {
    const { data, error } = await supabase.from('posts').select('id, content, created_at').eq('author_id', me).order('created_at', { ascending: false }).limit(50)
    if (error) throw error
    return (data ?? []).map((r) => ({ key: r.id as string, postId: r.id as string, text: clip(r.content as string), at: r.created_at as string }))
  }
  if (tab === 'comments') {
    const { data, error } = await supabase.from('comments').select('id, post_id, content, created_at').eq('author_id', me).order('created_at', { ascending: false }).limit(50)
    if (error) throw error
    return (data ?? []).map((r) => ({ key: r.id as string, postId: r.post_id as string, text: clip(r.content as string), at: r.created_at as string }))
  }
  const { data, error } = await supabase.from('post_likes').select('post_id, created_at, post:posts(content)').eq('user_id', me).order('created_at', { ascending: false }).limit(50)
  if (error) throw error
  return (data ?? []).map((r) => {
    const post = r.post as unknown as { content: string | null } | { content: string | null }[] | null
    const content = Array.isArray(post) ? post[0]?.content : post?.content
    return { key: r.post_id as string, postId: r.post_id as string, text: clip(content), at: r.created_at as string }
  })
}

const TABS: { id: Tab; label: string; icon: JSX.Element; empty: string }[] = [
  { id: 'posts', label: 'Posts', icon: <FileText size={14} />, empty: 'Posts you create will show here.' },
  { id: 'comments', label: 'Comments', icon: <MessageCircle size={14} />, empty: 'Comments you write will show here.' },
  { id: 'likes', label: 'Likes', icon: <Heart size={14} />, empty: 'Posts you like will show here.' },
]

/** Activity Log: your latest posts, comments and likes, with a link to each post. */
export default function ActivityLogPage() {
  const me = useMe()
  const [tab, setTab] = useState<Tab>('posts')
  const { data, loading, error } = useAsync(() => load(tab, me.id), [tab, me.id])
  const cur = TABS.find((t) => t.id === tab)!
  return (
    <>
      <PageHeader title="Activity Log" back />
      <div className="stack">
        <div style={{ display: 'flex', gap: 8, padding: '0 16px', flexWrap: 'wrap' }}>
          {TABS.map((t) => (
            <button key={t.id} type="button" className={tab === t.id ? 'btn btn--primary' : 'btn'} aria-pressed={tab === t.id} onClick={() => setTab(t.id)}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
        {loading ? <ListSkeleton rows={3} /> : null}
        {error ? <ErrorState message={error} /> : null}
        {data && !data.length ? <EmptyState icon={cur.icon} title="Nothing here yet" body={cur.empty} /> : null}
        {data?.length ? (
          <GlassPanel className="settings-list">
            {data.map((i) => (
              <Link key={i.key} to={`/p/${i.postId}`} className="list-row">
                <span className="grow"><span style={{ display: 'block' }}>{i.text}</span><span className="small muted">{timeAgo(i.at)}</span></span>
              </Link>
            ))}
          </GlassPanel>
        ) : null}
        <p className="small muted" style={{ padding: '0 16px' }}>Shows your latest 50. Open an item to edit or delete it.</p>
      </div>
    </>
  )
}
