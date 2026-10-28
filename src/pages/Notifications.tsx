import { useCallback, useEffect, useState, type ReactElement } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck, Heart, MessageCircle, UserPlus, Users, X } from 'lucide-react'
import type { AppNotification } from '@/types/db'
import { useMe } from '@/app/AuthProvider'
import { useBadges } from '@/app/BadgesProvider'
import { Avatar } from '@/components/ui/Avatar'
import { Button, IconButton } from '@/components/ui/Button'
import { EmptyState, ErrorState, ListSkeleton, Spinner } from '@/components/ui/Feedback'
import { PageHeader } from '@/components/ui/PageHeader'
import { useToast } from '@/components/ui/Toast'
import { useInfiniteSentinel, usePaged } from '@/hooks/common'
import { timeAgo } from '@/lib/format'
import { errorMessage } from '@/lib/supabase'
import { getCommunityById } from '@/services/communities'
import {
  deleteNotification,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeNotifications,
} from '@/services/notifications'

function describe(n: AppNotification): { text: string; icon: ReactElement } {
  switch (n.type) {
    case 'follow':
      return { text: 'started following you', icon: <UserPlus size={14} /> }
    case 'like':
      return { text: n.comment_id ? 'liked your comment' : 'liked your post', icon: <Heart size={14} /> }
    case 'comment':
      return { text: 'commented on your post', icon: <MessageCircle size={14} /> }
    case 'reply':
      return { text: 'replied to your comment', icon: <MessageCircle size={14} /> }
    case 'community_join':
      return { text: 'joined your community', icon: <Users size={14} /> }
    default:
      return { text: 'sent you a notification', icon: <Bell size={14} /> }
  }
}

export default function NotificationsPage() {
  const me = useMe()
  const navigate = useNavigate()
  const toast = useToast()
  const badges = useBadges()
  const { refreshNotifications, clearNotifications } = badges
  const { items, loading, loadingMore, error, hasMore, loadMore, reload, setItems } = usePaged<AppNotification>(fetchNotifications)
  const sentinel = useInfiniteSentinel(loadMore, hasMore && !loadingMore && !error)
  const [fresh, setFresh] = useState(false)

  // A new notification arrives while the page is open: offer a refresh instead of reshuffling the list under the reader.
  useEffect(() => subscribeNotifications(me.id, () => setFresh(true)), [me.id])

  const unread = items.filter((n) => !n.is_read).length

  const markAll = async () => {
    const before = items
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })))
    clearNotifications()
    try {
      await markAllNotificationsRead(me.id)
    } catch (e) {
      setItems(() => before)
      refreshNotifications()
      toast.error(errorMessage(e))
    }
  }

  const open = useCallback(
    async (n: AppNotification) => {
      if (!n.is_read) {
        setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)))
        void markNotificationRead(n.id).then(refreshNotifications).catch(() => refreshNotifications())
      }
      if (n.type === 'follow' && n.actor) return navigate(`/u/${n.actor.username}`)
      if (n.post_id) return navigate(n.type === 'comment' || n.type === 'reply' ? `/p/${n.post_id}#comments` : `/p/${n.post_id}`)
      if (n.type === 'community_join' && n.community_id) {
        try {
          const community = await getCommunityById(n.community_id)
          return navigate(community ? `/c/${community.slug}` : '/communities')
        } catch {
          return navigate('/communities')
        }
      }
      if (n.actor) navigate(`/u/${n.actor.username}`)
    },
    [navigate, refreshNotifications, setItems],
  )

  const dismiss = async (n: AppNotification) => {
    const before = items
    setItems((prev) => prev.filter((x) => x.id !== n.id))
    try {
      await deleteNotification(n.id)
      refreshNotifications()
    } catch (e) {
      setItems(() => before)
      toast.error(errorMessage(e))
    }
  }

  return (
    <>
      <PageHeader
        title="Notifications"
        actions={
          <Button variant="ghost" size="sm" icon={<CheckCheck size={16} />} disabled={unread === 0} onClick={() => void markAll()}>
            Mark all read
          </Button>
        }
      />

      {fresh ? (
        <button
          type="button"
          className="glass banner banner--info banner--button"
          onClick={() => {
            setFresh(false)
            reload()
            refreshNotifications()
          }}
        >
          <Bell size={18} aria-hidden /> New notifications. Tap to refresh.
        </button>
      ) : null}

      {loading ? (
        <ListSkeleton />
      ) : error && !items.length ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !items.length ? (
        <EmptyState
          icon={<Bell size={28} />}
          title="No notifications yet"
          body="Likes, comments, replies and new followers will show up here."
        />
      ) : (
        <div className="col">
          <ul className="glass notif-list" aria-label="Notifications">
            {items.map((n) => {
              const d = describe(n)
              const name = n.actor?.display_name || n.actor?.username || 'Someone'
              return (
                <li key={n.id} className={`notif ${n.is_read ? '' : 'notif--unread'}`}>
                  <button type="button" className="notif__main" onClick={() => void open(n)}>
                    <span className="notif__avatar">
                      <Avatar src={n.actor?.avatar_url} name={name} />
                      <span className="notif__icon" aria-hidden>{d.icon}</span>
                    </span>
                    <span className="grow" style={{ minWidth: 0 }}>
                      <span className="notif__text"><strong>{name}</strong> {d.text}</span>
                      <span className="small muted" style={{ display: 'block' }}>{timeAgo(n.created_at)}</span>
                    </span>
                    {!n.is_read ? <span className="unread-dot" aria-label="Unread" /> : null}
                  </button>
                  <IconButton label="Dismiss notification" small onClick={() => void dismiss(n)}>
                    <X size={16} />
                  </IconButton>
                </li>
              )
            })}
          </ul>
          {loadingMore ? <Spinner label="Loading more notifications" /> : null}
          {error ? <ErrorState message={error} onRetry={loadMore} /> : null}
          {hasMore && !loadingMore && !error ? (
            <div ref={sentinel} className="center"><Button variant="ghost" size="sm" onClick={loadMore}>Load more</Button></div>
          ) : null}
        </div>
      )}
    </>
  )
}
