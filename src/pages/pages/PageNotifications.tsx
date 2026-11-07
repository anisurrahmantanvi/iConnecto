import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Heart, MessageCircle, UserPlus } from 'lucide-react'
import { useMe } from '@/app/AuthProvider'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/Feedback'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { PageHeader } from '@/components/ui/PageHeader'
import { useAsync } from '@/hooks/common'
import { timeAgo } from '@/lib/format'
import { getPageBySlug, myPageRole } from '@/services/pages'
import { listPageNotifications, markPageNotificationsRead } from '@/services/pageNotifications'

const TEXT = { follow: 'followed your Page', like: 'liked a post on your Page', comment: 'commented on a post on your Page' } as const
const ICON = { follow: <UserPlus size={14} />, like: <Heart size={14} />, comment: <MessageCircle size={14} /> } as const

/** Notifications of a Page: only people who work on the Page can see them. */
export default function PageNotificationsPage() {
  const me = useMe()
  const { slug = '' } = useParams()
  const state = useAsync(async () => {
    const page = await getPageBySlug(slug)
    if (!page) return { page: null, items: [] as Awaited<ReturnType<typeof listPageNotifications>>, allowed: false }
    const role = await myPageRole(page.id, me.id)
    if (!role) return { page, items: [], allowed: false }
    return { page, items: await listPageNotifications(page.id), allowed: true }
  }, [slug, me.id])
  const pageId = state.data?.page?.id
  useEffect(() => { if (pageId && state.data?.allowed) void markPageNotificationsRead(pageId) }, [pageId, state.data?.allowed])

  return (
    <>
      <PageHeader title="Page notifications" back />
      <div className="stack">
        {state.loading ? <ListSkeleton rows={4} /> : state.error ? <ErrorState message={state.error} onRetry={state.reload} /> : !state.data?.allowed ? (
          <EmptyState title="Not available" body="Only people who work on this Page can see its notifications." />
        ) : state.data.items === null ? (
          <EmptyState title="Available after the next database update" body="Page notifications will appear here once the update is installed." />
        ) : !state.data.items.length ? (
          <EmptyState title="No notifications yet" body="New followers, likes and comments on your Page posts show up here." />
        ) : (
          <GlassPanel className="settings-list">
            {state.data.items.map((n) => (
              <Link key={n.id} to={n.post_id ? `/p/${n.post_id}` : `/page/${slug}`} className="list-row">
                <Avatar src={n.actor?.avatar_url ?? null} name={n.actor?.display_name || n.actor?.username || 'Someone'} size="md" />
                <span className="grow" style={{ minWidth: 0 }}>
                  <strong>{n.actor?.display_name || n.actor?.username || 'Someone'}</strong> {TEXT[n.type]}
                  <span className="small muted" style={{ display: 'block' }}>{ICON[n.type]} {timeAgo(n.created_at)}</span>
                </span>
                {!n.is_read ? <span className="dot" aria-label="New" /> : null}
              </Link>
            ))}
          </GlassPanel>
        )}
      </div>
    </>
  )
}
